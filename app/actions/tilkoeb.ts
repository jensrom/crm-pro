"use server";

/**
 * Tilkøb og reduktioner af licenser på en kunde.
 *
 * Hver registrering flytter licensantallet på kundens linje for licensen og
 * gemmes som en post i historikken, så det altid kan ses hvornår der blev
 * købt hvad, til hvilken pris og af hvem det blev registreret.
 */
import { db } from "@/lib/db";
import { kraevAdmin, kraevSkriv } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registrerLicensaendring as registrer } from "@/lib/licenser";
import { formular } from "@/lib/formular";
import { ejedePakker, maaVaelges } from "@/lib/pakker";

function opfrisk(kundeId: string) {
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/kunder");
  revalidatePath("/tilkoeb");
  revalidatePath("/produkter");
  revalidatePath("/dashboard");
}

export async function registrerLicensaendring(kundeId: string, formData: FormData) {
  const mig = await kraevSkriv("salg");
  const f = formular(formData);
  const productId = f.tekst("productId");
  const antal = f.heltal("antal") ?? 0;
  const reduktion = formData.get("retning") === "reduktion";
  const tilbage = `/kunder/${kundeId}?fane=produkter`;

  if (!productId || antal <= 0) redirect(`${tilbage}&tilkoeb=mangler#tilkoeb`);

  const produkt = await db.product.findUnique({ where: { id: productId } });
  if (!produkt) redirect(`${tilbage}&tilkoeb=mangler#tilkoeb`);

  // Kun den pakke kunden ejer, kan købes til — et skift af pakke er en opgradering af aftalen
  const ejede = await db.customerProduct.findMany({
    where: { companyId: kundeId, isActive: true },
    include: { product: { select: { familyId: true, licenseModel: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!maaVaelges(produkt, ejedePakker(ejede))) redirect(`${tilbage}&tilkoeb=pakke#tilkoeb`);

  const linje = await db.customerProduct.findFirst({
    where: { companyId: kundeId, productId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const foer = linje?.seats ?? 0;
  const delta = reduktion ? -antal : antal;
  if (foer + delta < 0) redirect(`${tilbage}&tilkoeb=for-mange#tilkoeb`);

  // Prisen pr. licens: det du skriver — ellers kundens aftalte pris, ellers listeprisen.
  const perpetual = produkt.licenseModel === "perpetual";
  const pris =
    f.tal("unitPrice") ??
    (perpetual ? produkt.oneTimePrice : linje?.unitPriceMonth ?? produkt.pricePerUserMonth);
  const dato = f.dato("date") ?? new Date();
  const note = f.tekst("note");

  await db.$transaction((tx) =>
    registrer(tx, {
      companyId: kundeId,
      productId,
      delta,
      unitPrice: pris,
      date: dato,
      note,
      initials: mig.initials,
      linjeId: linje?.id ?? null,
      ny: { startDate: dato },
    })
  );

  opfrisk(kundeId);
  redirect(`${tilbage}&tilkoeb=gemt#tilkoeb`);
}

/**
 * Fortryder en registrering: posten slettes, og licensantallet på linjen
 * flyttes tilbage med samme antal. Kræver administrator.
 */
export async function fortrydLicensaendring(id: string) {
  await kraevAdmin();
  const post = await db.licenseChange.findUnique({ where: { id } });
  if (!post) return;

  // Den præcise linje, hvis posten kender den — ellers (ældre poster) kundens første linje med licensen
  const linje = post.customerProductId
    ? await db.customerProduct.findUnique({ where: { id: post.customerProductId } })
    : await db.customerProduct.findFirst({
        where: { companyId: post.companyId, productId: post.productId, isActive: true },
        orderBy: { createdAt: "asc" },
      });

  await db.$transaction(async (tx) => {
    if (linje) {
      await tx.customerProduct.update({
        where: { id: linje.id },
        data: { seats: Math.max(0, linje.seats - post.quantity) },
      });
    }
    await tx.licenseChange.delete({ where: { id } });
  });

  opfrisk(post.companyId);
  redirect(`/kunder/${post.companyId}?fane=produkter&tilkoeb=fortrudt#tilkoeb`);
}
