import "server-only";
import { db } from "@/lib/db";

export const LICENSMODELLER = [
  { key: "sub", label: "Subscription", kort: "Sub", enhed: "pr. bruger/md." },
  { key: "perpetual", label: "Perpetual", kort: "Perpetual", enhed: "pr. licens (engang)" },
] as const;

export function licensmodel(key: string | null | undefined) {
  return LICENSMODELLER.find((m) => m.key === key) ?? LICENSMODELLER[0];
}

/** Licensens gældende listepris — månedspris for sub, engangspris for perpetual. */
export function listepris(p: { licenseModel?: string | null; pricePerUserMonth: number | null; oneTimePrice?: number | null }) {
  return p.licenseModel === "perpetual" ? p.oneTimePrice ?? null : p.pricePerUserMonth;
}

/**
 * Lægger prisændringer over på licensen, når deres dato er nået.
 *
 * Kaldes fra app-layoutet, så en planlagt prisændring træder i kraft ved første
 * sidevisning på eller efter datoen. Skriver kun i databasen når der faktisk er
 * noget at gøre — ellers er det én hurtig læsning på et indeks.
 */
export async function anvendPlanlagtePriser(nu = new Date()) {
  const klar = await db.productPrice.findMany({
    where: { appliedAt: null, validFrom: { lte: nu } },
    include: { product: { select: { id: true, licenseModel: true } } },
    orderBy: { validFrom: "asc" },
  });
  for (const pp of klar) {
    const felt = pp.product.licenseModel === "perpetual" ? { oneTimePrice: pp.price } : { pricePerUserMonth: pp.price };
    await db.$transaction([
      db.product.update({ where: { id: pp.productId }, data: felt }),
      db.productPrice.update({ where: { id: pp.id }, data: { appliedAt: nu } }),
    ]);
  }
  return klar.length;
}

/** Hele kataloget: produkter med deres licenser, i den rækkefølge du har sat. */
export async function hentKatalog({ kunAktive = false } = {}) {
  const familier = await db.productFamily.findMany({
    where: kunAktive ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: kunAktive ? { isActive: true } : undefined,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  const uplacerede = await db.product.findMany({
    where: { familyId: null, ...(kunAktive ? { isActive: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return { familier, uplacerede };
}

/** Licenser grupperet efter produkt — til <optgroup> i dropdowns. */
export async function licensGrupper({ kunAktive = true } = {}) {
  const { familier, uplacerede } = await hentKatalog({ kunAktive });
  const grupper = familier
    .filter((f) => f.products.length > 0)
    .map((f) => ({ id: f.id, navn: f.name, licenser: f.products }));
  if (uplacerede.length) grupper.push({ id: "uden", navn: "Uden produkt", licenser: uplacerede });
  return grupper;
}
