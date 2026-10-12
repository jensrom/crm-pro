import { STADIER } from "@/lib/labels";

/**
 * Fælles regler for salgs-pipelinen — brugt af kundesidens statusboard og
 * af den samlede pipeline-side, så "afsluttet" betyder det samme begge steder.
 */

/** Standard: så mange dage står en vundet/tabt sag på boardet, før den ryddes væk. */
export const STANDARD_AFSLUTTET_DAGE = 14;

/** De stadier der stadig er i spil — rækkefølgen er boardets kolonner. */
export const AABNE_STADIER = STADIER.filter((s) => s.key !== "vundet" && s.key !== "tabt");

export const erAfsluttet = (stage: string) => stage === "vundet" || stage === "tabt";

export const stadieLabel = (key: string) => STADIER.find((s) => s.key === key)?.label ?? key;

/** Forrige og næste åbne stadie. Fra sidste åbne stadie er næste skridt "vundet". */
export function naboStadier(stage: string): { forrige: string | null; naeste: string | null } {
  const i = AABNE_STADIER.findIndex((s) => s.key === stage);
  if (i === -1) return { forrige: null, naeste: null };
  return {
    forrige: i > 0 ? AABNE_STADIER[i - 1].key : null,
    naeste: i < AABNE_STADIER.length - 1 ? AABNE_STADIER[i + 1].key : "vundet",
  };
}

/** Standard-sandsynlighed når en sag flyttes til et stadie. Kan altid rettes på sagen. */
export const STADIE_SANDSYNLIGHED: Record<string, number> = {
  ny: 10,
  kvalificeret: 25,
  tilbud: 50,
  forhandling: 75,
  vundet: 100,
  tabt: 0,
};

type VaerdiSag = {
  value: number | null;
  seatDelta: number | null;
  product?: { pricePerUserMonth: number | null } | null;
};

/** Årsværdi: din egen indtastning slår beregningen fra pakkeprisen. */
export function sagsVaerdi(s: VaerdiSag): number | null {
  if (s.value != null) return s.value;
  if (s.seatDelta && s.product?.pricePerUserMonth) return s.seatDelta * s.product.pricePerUserMonth * 12;
  return null;
}

const DAG = 86_400_000;

export function dageSiden(fra: Date | null | undefined, nu = new Date()): number | null {
  if (!fra) return null;
  return Math.max(0, Math.floor((nu.getTime() - fra.getTime()) / DAG));
}

/** Hvor mange dage en afsluttet sag har tilbage på boardet. */
export function dageTilOprydning(closedAt: Date | null, dage: number, nu = new Date()): number {
  const siden = dageSiden(closedAt, nu) ?? 0;
  return Math.max(0, dage - siden);
}

/**
 * Deler sagerne op til boardet: åbne, afsluttede der stadig vises, og
 * afsluttede der er ryddet væk (ældre end `dage`). En afsluttet sag uden
 * lukkedato (fx indlæst data) betragtes som gammel og ryddes væk.
 */
export function delPipeline<T extends { stage: string; closedAt: Date | null }>(
  sager: T[],
  dage: number,
  nu = new Date()
) {
  const graense = nu.getTime() - dage * DAG;
  const aabne: T[] = [];
  const afsluttet: T[] = [];
  const ryddet: T[] = [];
  for (const s of sager) {
    if (!erAfsluttet(s.stage)) aabne.push(s);
    else if (s.closedAt && s.closedAt.getTime() >= graense) afsluttet.push(s);
    else ryddet.push(s);
  }
  afsluttet.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
  ryddet.sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
  return { aabne, afsluttet, ryddet };
}

/** Dagene fra indstillingerne — med fornuftige grænser. */
export function afsluttetDage(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return STANDARD_AFSLUTTET_DAGE;
  return Math.min(365, Math.max(0, Math.round(v)));
}
