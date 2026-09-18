/**
 * Priser og budget.
 *
 * Ét princip: budget regnes UDELUKKENDE på de licenser kunden faktisk har.
 * Antal ansatte og omsætning indgår aldrig i en pris eller et scope — det er
 * baggrundsviden om virksomhedens størrelse, ikke et beregningsgrundlag.
 */

export const PAKKER = [
  { tier: "small",  navn: "Small",  pris: 330, sortOrder: 1 },
  { tier: "medium", navn: "Medium", pris: 550, sortOrder: 2 },
  { tier: "large",  navn: "Large",  pris: 695, sortOrder: 3 },
] as const;

export type PakkeInfo = { pricePerUserMonth: number | null } | null | undefined;

/** Prisen der gælder for en kundes linje: aftalt pris slår pakkens listepris. */
export function gaeldendeMaanedspris(
  unitPriceMonth: number | null | undefined,
  produkt: PakkeInfo
): number | null {
  if (unitPriceMonth != null) return unitPriceMonth;
  return produkt?.pricePerUserMonth ?? null;
}

export function maanedsvaerdi(seats: number, maanedspris: number | null) {
  return maanedspris == null ? null : seats * maanedspris;
}

export function aarsvaerdi(seats: number, maanedspris: number | null) {
  return maanedspris == null ? null : seats * maanedspris * 12;
}

/** Summerer årsværdien af en række pakkelinjer. Linjer uden pris tælles som 0. */
export function samletAarsvaerdi(
  linjer: { seats: number; unitPriceMonth: number | null; product: PakkeInfo }[]
) {
  return linjer.reduce((sum, l) => {
    const pris = gaeldendeMaanedspris(l.unitPriceMonth, l.product);
    return sum + (pris == null ? 0 : l.seats * pris * 12);
  }, 0);
}

/** Hvor mange linjer mangler en pris — så tallet ikke læses som fuldstændigt. */
export function linjerUdenPris(
  linjer: { unitPriceMonth: number | null; product: PakkeInfo }[]
) {
  return linjer.filter((l) => gaeldendeMaanedspris(l.unitPriceMonth, l.product) == null).length;
}
