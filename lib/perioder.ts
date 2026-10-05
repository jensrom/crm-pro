/**
 * Datoregning for aftaler og ordrelinjer. Ren logik uden server-afhængigheder,
 * så den samme beregning bruges i formularens udregner og på serveren.
 *
 * En periode er [start; slut] begge dage inklusive. 12 måneder fra 1. januar
 * slutter 31. december.
 */

export function plusMaaneder(d: Date, m: number) {
  const r = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  r.setMonth(r.getMonth() + m);
  // Hold dagen, men ikke ud over månedens sidste dag (31. jan + 1 md. = 28./29. feb)
  const sidste = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), sidste));
  return r;
}

export function plusDage(d: Date, n: number) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  r.setDate(r.getDate() + n);
  return r;
}

/** Sidste dag i en periode på m måneder fra start. */
export function slutFraMaaneder(start: Date, m: number) {
  return plusDage(plusMaaneder(start, m), -1);
}

/**
 * Hvor mange hele måneder der skal faktureres for at dække start → slut.
 * Påbegyndte måneder tæller som hele — 1 måned og 3 dage giver 2.
 */
export function maanederMellem(start: Date, slut: Date) {
  if (slut < start) return 0;
  let m = 1;
  while (slutFraMaaneder(start, m) < dagStart(slut) && m < 600) m++;
  return m;
}

export function dagStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

/**
 * Aftalens nuværende udløb: endDate hvis den er sat — ellers den
 * aftaleperiode (startdato + n × termMonths), der dækker i dag.
 */
export function aftaleUdloeb(
  l: { startDate: Date; endDate: Date | null; termMonths?: number | null },
  nu = new Date()
): Date {
  if (l.endDate) return dagStart(l.endDate);
  const term = Math.max(1, l.termMonths ?? 12);
  let fra = dagStart(l.startDate);
  let slut = slutFraMaaneder(fra, term);
  let vagt = 0;
  while (slut < dagStart(nu) && vagt++ < 500) {
    fra = plusDage(slut, 1);
    slut = slutFraMaaneder(fra, term);
  }
  return slut;
}

/** Den nuværende aftaleperiode: fra (udløb − term + 1 dag, dog ikke før start) til udløb. */
export function aftalePeriode(l: { startDate: Date; endDate: Date | null; termMonths?: number | null }, nu = new Date()) {
  const til = aftaleUdloeb(l, nu);
  const term = Math.max(1, l.termMonths ?? 12);
  const beregnetFra = plusDage(plusMaaneder(plusDage(til, 1), -term), 0);
  const start = dagStart(l.startDate);
  return { fra: beregnetFra < start ? start : beregnetFra, til };
}

/** Næste periode efter udløb: dagen efter + term måneder. */
export function fornyelsesPeriode(l: { startDate: Date; endDate: Date | null; termMonths?: number | null }, nu = new Date()) {
  const fra = plusDage(aftaleUdloeb(l, nu), 1);
  const term = Math.max(1, l.termMonths ?? 12);
  return { fra, til: slutFraMaaneder(fra, term), maaneder: term };
}

export function isoDag(d: Date | null | undefined) {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fraIso(s: string | null | undefined): Date | null {
  const m = s?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const dagTekst = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d) : "";
