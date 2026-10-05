"use server";

/**
 * Tilkøb og reduktioner af licenser på en kunde.
 *
 * Hver registrering flytter licensantallet på kundens linje for licensen og
 * gemmes som en post i historikken, så det altid kan ses hvornår der blev
 * købt hvad, til hvilken pris og af hvem det blev registreret.
 */
import { db } from "@/lib/db";
import { kraevAdmin, kraevBruger } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { registrerLicensaendring as registrer } from "@/lib/licenser";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  if (s == null) return null;
  const n = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function datoFra(v: FormDataEntryValue | null) {
  const s = txt(v);
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function opfrisk(kundeId: string) {
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/kunder");
  revalidatePath("/tilkoeb");
  revalidatePath("/produkter");
  revalidatePath("/dashboard");
}

export async function registrerLicensaendring(kundeId: string, formData: FormData) {
  const mig = await kraevBruger();
  const productId = txt(formData.get("productId"));
  const antal = Math.round(num(formData.get("antal")) ?? 0);
  const reduktion = formData.get("retning") === "reduktion";
  const tilbage = `/kunder/${kundeId}`;

  if (!productId || antal <= 0) redirect(`${tilbage}?tilkoeb=mangler#tilkoeb`);

  const produkt = await db.product.findUnique({ where: { id: productId } });
  if (!produkt) redirect(`${tilbage}?tilkoeb=mangler#tilkoeb`);

  const linje = await db.customerProduct.findFirst({
    where: { companyId: kundeId, productId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const foer = linje?.seats ?? 0;
  const delta = reduktion ? -antal : antal;
  if (foer + delta < 0) redirect(`${tilbage}?tilkoeb=for-mange#tilkoeb`);

  // Prisen pr. licens: det du skriver — ellers kundens aftalte pris, ellers listeprisen.
  const perpetual = produkt.licenseModel === "perpetual";
  const pris =
    num(formData.get("unitPrice")) ??
    (perpetual ? produkt.oneTimePrice : linje?.unitPriceMonth ?? produkt.pricePerUserMonth);
  const dato = datoFra(formData.get("date"));
  const note = txt(formData.get("note"));

  await db.$transaction((tx) =>
    registrer(tx, {
      companyId: kundeId,
      productId,
      delta,
      unitPrice: pris,
      date: dato,
      note,
      initials: mig.initials,
      ny: { startDate: dato },
    })
  );

  opfrisk(kundeId);
  redirect(`${tilbage}?tilkoeb=gemt#tilkoeb`);
}

/**
 * Fortryder en registrering: posten slettes, og licensantallet på linjen
 * flyttes tilbage med samme antal. Kræver administrator.
 */
export async function fortrydLicensaendring(id: string) {
  await kraevAdmin();
  const post = await db.licenseChange.findUnique({ where: { id } });
  if (!post) return;

  const linje = await db.customerProduct.findFirst({
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
  redirect(`/kunder/${post.companyId}?tilkoeb=fortrudt#tilkoeb`);
}
