import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";
import { brugerensProfilId, dokNr, filnavn, hentAfsender, subNr } from "@/lib/dokumenter";
import { kanLaveLicensbevis } from "@/lib/intern";
import { lavOrdreLicensbevis } from "@/lib/pdf";
import { gemDokumentIFilboks } from "@/lib/filer";

export const runtime = "nodejs";

/**
 * Licensbevis for ét produkt på en ordre, som intern salg har gjort klar til kunden.
 *   ?linje=<ordrelinje-id>[&gem=1]   gem=1 lægger beviset i kundens filboks og logbog
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
  const l = o.lines.find((x) => x.id === q.get("linje"));
  if (!l || !l.productId || l.licenseModel === "fee") return new NextResponse("Linjen findes ikke eller er ikke en licens", { status: 404 });

  const produkt = await db.product.findUnique({ where: { id: l.productId }, include: { family: true } });
  // SUB-nøglen: ordrens egen, ellers kundens linje for licensen
  const cp = l.customerProductId ? await db.customerProduct.findUnique({ where: { id: l.customerProductId }, include: { contract: true } }) : null;
  const sub = o.contract?.subNumber ?? cp?.contract?.subNumber ?? null;
  const perpetual = l.licenseModel === "perpetual";
  const k = o.company;

  const bytes = await lavOrdreLicensbevis({
    afsender: await hentAfsender(o.senderProfileId ?? (await brugerensProfilId(session.id))),
    kunde: {
      navn: k?.name ?? o.recipientName,
      adresse: k?.address ?? o.recipientAddress,
      postby: k ? [k.zipCode, k.city].filter(Boolean).join(" ") : null,
      land: k?.country ?? null,
      cvr: k?.orgNumber ?? null,
      konto: k?.accountId ?? null,
    },
    ordrenr: dokNr(o),
    leverandoerRef: l.leverandoerRef,
    leverandoerOrdrenr: o.leverandoerOrdrenr,
    produkt: produkt?.family?.name ?? "",
    licens: produkt?.name ?? l.description,
    perpetual,
    antal: l.quantity,
    placering: l.placering,
    partNr: l.partNr,
    version: l.version,
    detaljer: l.details,
    subNr: sub != null ? subNr(sub) : null,
    fra: l.periodStart,
    til: l.periodEnd,
    pris: l.unitPrice == null ? null : l.quantity * l.unitPrice * (l.months ?? 1),
    udstedt: new Date(),
    udstedtAf: session.initials,
  });

  const navn = filnavn("Licensbevis", dokNr(o), produkt?.name ?? "licens", k?.name ?? o.recipientName);
  if (q.get("gem") === "1" && o.companyId) {
    await gemDokumentIFilboks(o.companyId, navn, bytes, "licensbevis", session.initials);
    await db.logEntry.create({
      data: { companyId: o.companyId, kind: "aftale", content: `Licensbevis udstedt: ${produkt?.name ?? l.description} (${dokNr(o)})`, author: session.initials },
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
