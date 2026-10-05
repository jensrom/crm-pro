import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { filnavn, fraIsoDato, hentAfsender, sikrSubNumre, subNr } from "@/lib/dokumenter";
import { licensmodel } from "@/lib/katalog";
import { lavLicensbevis } from "@/lib/pdf";
import { gemDokumentIFilboks } from "@/lib/filer";

export const runtime = "nodejs";

/**
 * Licensbevis som PDF.
 *   ?kunde=<id>&linje=<id>&linje=<id>…&fra_<id>=yyyy-mm-dd&til_<id>=yyyy-mm-dd[&gem=1]
 * Uden linje-parametre kommer alle kundens aktive licenser med.
 */
export async function GET(req: Request) {
  const session = await hentSession();
  if (!session) return new NextResponse("Ikke logget ind", { status: 401 });

  const q = new URL(req.url).searchParams;
  const kundeId = q.get("kunde");
  if (!kundeId) return new NextResponse("Kunde mangler", { status: 400 });
  const valgte = q.getAll("linje");

  await sikrSubNumre(kundeId);
  const kunde = await db.company.findUnique({
    where: { id: kundeId },
    include: {
      customerProducts: {
        where: { isActive: true, ...(valgte.length ? { id: { in: valgte } } : {}) },
        include: { product: { include: { family: true } } },
        orderBy: { subNumber: "asc" },
      },
    },
  });
  if (!kunde) return new NextResponse("Kunden findes ikke", { status: 404 });
  if (kunde.customerProducts.length === 0) {
    return NextResponse.redirect(new URL(`/kunder/${kundeId}/licensbevis`, req.url), 303);
  }

  const linjer = kunde.customerProducts
    .sort((a, b) => (a.product.family?.sortOrder ?? 999) - (b.product.family?.sortOrder ?? 999) || (a.subNumber ?? 0) - (b.subNumber ?? 0))
    .map((l) => ({
      sub: subNr(l.subNumber),
      produkt: l.product.family?.name ?? "",
      licens: l.product.name,
      model: licensmodel(l.product.licenseModel).label,
      antal: l.seats,
      fra: fraIsoDato(q.get(`fra_${l.id}`)) ?? l.startDate,
      til: fraIsoDato(q.get(`til_${l.id}`)),
    }));

  const udstedt = new Date();
  const reference = linjer.length === 1 ? linjer[0].sub : `${linjer[0].sub} m.fl.`;
  const bytes = await lavLicensbevis({
    afsender: await hentAfsender(),
    kunde: {
      navn: kunde.name,
      adresse: kunde.address,
      postby: [kunde.zipCode, kunde.city].filter(Boolean).join(" ") || null,
      land: kunde.country,
      cvr: kunde.orgNumber,
      konto: kunde.accountId,
    },
    reference,
    udstedt,
    udstedtAf: session.name,
    linjer,
  });

  const navn = filnavn(
    "Licensbevis",
    kunde.name,
    linjer.length === 1 ? linjer[0].sub : `${linjer.length}-licenser`,
    udstedt.toISOString().slice(0, 10)
  );

  if (q.get("gem") === "1") {
    await gemDokumentIFilboks(kunde.id, navn, bytes, "licensbevis", session.initials);
    revalidatePath(`/kunder/${kunde.id}`);
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(navn)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
