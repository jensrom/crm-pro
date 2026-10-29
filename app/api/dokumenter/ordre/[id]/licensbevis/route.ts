import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";
import { brugerensProfilId, dokNr, dokumentFilnavn, haendelser, hentAfsender, subNr } from "@/lib/dokumenter";
import { kanLaveLicensbevis } from "@/lib/intern";
import { datoTekst, lavOrdreLicensbevis, samlPdf } from "@/lib/pdf";
import { kundeNr } from "@/lib/kundenr";
import { gemDokumentIFilboks } from "@/lib/filer";

export const runtime = "nodejs";

/**
 * Licensbevis på en ordre, som intern salg har gjort klar til kunden.
 *   ?linje=<ordrelinje-id>   én linje
 *   ?produkt=<productId>     samlet bevis for licensen: alle ordrens linjer med den
 *                            (fx fornyelse + tilkøb) lægges sammen på ét bevis
 *   ?alle=1                  ét samlet bevis pr. licens, alle i én PDF
 *   [&gem=1]                 lægger beviset i kundens filboks og logbog
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await hentSession();
  if (!session) return new NextResponse("Ikke logget ind", { status: 401 });
  if (!session.ret.intern && !kanLaese(session.ret.salg)) return new NextResponse("Ingen adgang", { status: 403 });

  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      lines: true,
      company: true,
      contract: { select: { subNumber: true } },
    },
  });
  if (!o) return new NextResponse("Ordren findes ikke", { status: 404 });
  if (!kanLaveLicensbevis(o.internStatus)) return new NextResponse("Licensbevis kan først laves, når ordren er Klar til kunde", { status: 409 });
  // Licenslinjerne grupperet pr. produkt (fornyelse + tilkøb af samme licens hører sammen)
  const licenser = o.lines
    .filter((x) => x.productId && x.licenseModel !== "fee")
    .sort((x, y) => x.sortOrder - y.sortOrder);
  const grupper = new Map<string, typeof licenser>();
  for (const x of licenser) grupper.set(x.productId!, [...(grupper.get(x.productId!) ?? []), x]);

  let valgte: (typeof licenser)[];
  if (q.get("alle") === "1") valgte = [...grupper.values()];
  else if (q.get("produkt")) valgte = grupper.has(q.get("produkt")!) ? [grupper.get(q.get("produkt")!)!] : [];
  else {
    const l = licenser.find((x) => x.id === q.get("linje"));
    valgte = l ? [[l]] : [];
  }
  if (!valgte.length) return new NextResponse("Linjen findes ikke eller er ikke en licens", { status: 404 });

  const k = o.company;
  const afsender = await hentAfsender(o.senderProfileId ?? (await brugerensProfilId(session.id)));
  const kunde = {
    navn: k?.name ?? o.recipientName,
    afdeling: k?.department ?? null,
    nummer: k ? kundeNr(k.customerNumber) : null,
    adresse: k?.address ?? o.recipientAddress,
    postby: k ? [k.zipCode, k.city].filter(Boolean).join(" ") : null,
    land: k?.country ?? null,
    cvr: k?.orgNumber ?? null,
    konto: k?.accountId ?? null,
  };
  const art = (lk: string) => (lk === "fornyelse" ? "Fornyelse" : lk === "tilkoeb" ? "Tilkøb" : lk === "opgradering" ? "Opgradering" : "Ny licens");
  const udstedt = new Date();

  /** Ét bevis for én licens: flere linjer (fx fornyelse + tilkøb) lægges sammen. */
  const bevis = async (ls: typeof licenser) => {
    const l = ls[0];
    const produkt = await db.product.findUnique({ where: { id: l.productId! }, include: { family: true } });
    const cps = await Promise.all(
      ls.filter((x) => x.customerProductId).map((x) => db.customerProduct.findUnique({ where: { id: x.customerProductId! }, include: { contract: true } }))
    );
    // SUB-nøglen: ordrens egen, ellers kundens linje for licensen
    const sub = o.contract?.subNumber ?? cps.find((c) => c?.contract)?.contract?.subNumber ?? null;
    const foerst = <T,>(f: (x: (typeof ls)[number]) => T | null) => ls.map(f).find((v) => v != null && v !== "") ?? null;
    const starter = ls.map((x) => x.periodStart).filter((d): d is Date => !!d);
    const slutter = ls.map((x) => x.periodEnd).filter((d): d is Date => !!d);
    const priser = ls.map((x) => (x.unitPrice == null ? null : x.quantity * x.unitPrice * (x.months ?? 1)));
    const datoer = (x: (typeof ls)[number]) =>
      x.periodStart && x.periodEnd ? `, ${datoTekst(x.periodStart)} – ${datoTekst(x.periodEnd)}` : "";
    const sammensat = ls.length > 1 ? ls.map((x) => `${art(x.lineKind)}: ${x.quantity} ${x.quantity === 1 ? "licens" : "licenser"}${datoer(x)}`) : [];
    const detaljer = [...sammensat, ...[...new Set(ls.map((x) => x.details).filter(Boolean))]].join("\n") || null;
    return {
      navn: produkt?.name ?? l.description,
      bytes: await lavOrdreLicensbevis({
        afsender,
        kunde,
        ordrenr: dokNr(o),
        leverandoerRef: foerst((x) => x.leverandoerRef),
        leverandoerOrdrenr: o.leverandoerOrdrenr,
        produkt: produkt?.family?.name ?? "",
        licens: produkt?.name ?? l.description,
        perpetual: l.licenseModel === "perpetual",
        antal: ls.reduce((s2, x) => s2 + x.quantity, 0),
        placering: foerst((x) => x.placering),
        partNr: foerst((x) => x.partNr),
        version: foerst((x) => x.version),
        detaljer,
        subNr: sub != null ? subNr(sub) : null,
        fra: starter.length ? new Date(Math.min(...starter.map((d) => d.getTime()))) : null,
        til: slutter.length ? new Date(Math.max(...slutter.map((d) => d.getTime()))) : null,
        pris: priser.every((x) => x == null) ? null : priser.reduce<number>((s2, x) => s2 + (x ?? 0), 0),
        udstedt,
        udstedtAf: session.initials,
      }),
    };
  };

  const beviser = [];
  for (const g of valgte) beviser.push(await bevis(g));
  const bytes = beviser.length === 1 ? beviser[0].bytes : await samlPdf(beviser.map((b) => b.bytes));

  const navn = dokumentFilnavn({
    id: dokNr(o),
    kunde: kunde.afdeling ? `${kunde.navn} ${kunde.afdeling}` : kunde.navn,
    dato: udstedt,
    initialer: session.initials,
    produkt: beviser.map((b) => b.navn).join(" + "),
    haendelse: `Licensbevis (${haendelser(valgte.flat())})`,
  });
  if (q.get("gem") === "1" && o.companyId) {
    await gemDokumentIFilboks(o.companyId, navn, bytes, "licensbevis", session.initials);
    await db.logEntry.create({
      data: { companyId: o.companyId, kind: "aftale", content: `Licensbevis udstedt: ${beviser.map((b) => b.navn).join(", ")} (${dokNr(o)})`, author: session.initials },
    });
    revalidatePath(`/kunder/${o.companyId}`);
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(navn)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
