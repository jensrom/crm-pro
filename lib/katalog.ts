import "server-only";
import { db } from "@/lib/db";

export const LICENSMODELLER = [
  { key: "sub", label: "Subscription", kort: "Sub", enhed: "pr. bruger/md.", beskrivelse: "Abonnement — pris pr. bruger pr. måned" },
  { key: "perpetual", label: "Perpetual", kort: "Perpetual", enhed: "pr. licens (engang)", beskrivelse: "Købt én gang — pris pr. licens" },
  { key: "fee", label: "Engangsydelse", kort: "Ydelse", enhed: "pr. stk. (engang)", beskrivelse: "Gebyr eller ydelse — fx extension fee, opsætning, kursus. Bliver aldrig en licens på kunden" },
] as const;

/** Engangspris (oneTimePrice) i stedet for månedspris: perpetual og engangsydelser. */
export const erEngang = (m: string | null | undefined) => m === "perpetual" || m === "fee";
/** Engangsydelser er ikke licenser — de kan kun bruges på tilbud og ordrer. */
export const erYdelse = (m: string | null | undefined) => m === "fee";

export function licensmodel(key: string | null | undefined) {
  return LICENSMODELLER.find((m) => m.key === key) ?? LICENSMODELLER[0];
}

/** Licensens gældende listepris — månedspris for sub, engangspris for perpetual. */
export function listepris(p: { licenseModel?: string | null; pricePerUserMonth: number | null; oneTimePrice?: number | null }) {
  return erEngang(p.licenseModel) ? p.oneTimePrice ?? null : p.pricePerUserMonth;
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
    const felt = erEngang(pp.product.licenseModel) ? { oneTimePrice: pp.price } : { pricePerUserMonth: pp.price };
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

/** Licenser grupperet efter produkt — til <optgroup> i dropdowns. Engangsydelser er ikke licenser og er udeladt. */
export async function licensGrupper({ kunAktive = true } = {}) {
  const { familier, uplacerede } = await hentKatalog({ kunAktive });
  const kunLicenser = <T extends { licenseModel: string }>(l: T[]) => l.filter((p) => !erYdelse(p.licenseModel));
  const grupper = familier
    .map((f) => ({ id: f.id, navn: f.name, licenser: kunLicenser(f.products) }))
    .filter((g) => g.licenser.length > 0);
  const uden = kunLicenser(uplacerede);
  if (uden.length) grupper.push({ id: "uden", navn: "Uden produkt", licenser: uden });
  return grupper;
}
