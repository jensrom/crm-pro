/** Hjælpere til sager, klippekort og tid. */

export const sagsnummer = (n: number) => `SAG-${String(n).padStart(4, "0")}`;
export const kortnummer = (n: number) => `KK-${String(n).padStart(4, "0")}`;

/** Minutter vist som timer og minutter — 135 bliver til "2 t 15 min". */
export function varighed(minutter: number | null | undefined) {
  if (minutter == null) return "–";
  const neg = minutter < 0;
  const m = Math.abs(Math.round(minutter));
  const t = Math.floor(m / 60);
  const rest = m % 60;
  const tekst = t === 0 ? `${rest} min` : rest === 0 ? `${t} t` : `${t} t ${rest} min`;
  return neg ? `-${tekst}` : tekst;
}

/** Timer som decimaltal, fx 2,25 t. */
export const timer = (minutter: number) => minutter / 60;

export type Klippekort = {
  totalHours: number;
  usedMinutes: number;
  expiresAt: Date | null;
  isActive: boolean;
};

export function kortstatus(k: Klippekort, nu = new Date()) {
  const koebteMin = Math.round(k.totalHours * 60);
  const restMin = koebteMin - k.usedMinutes;
  const forbrugt = koebteMin > 0 ? k.usedMinutes / koebteMin : 0;
  const udloebet = k.expiresAt != null && k.expiresAt < nu;
  return {
    koebteMin,
    restMin,
    forbrugt,
    udloebet,
    opbrugt: restMin <= 0,
    /** Under en fjerdedel tilbage — værd at nævne inden kunden løber tør. */
    naestenOpbrugt: restMin > 0 && forbrugt >= 0.75,
    brugbart: k.isActive && !udloebet && restMin > 0,
  };
}

/** Hvor gammel en sag er, i hele dage. */
export function alderIDage(oprettet: Date, nu = new Date()) {
  return Math.floor((nu.getTime() - oprettet.getTime()) / 86_400_000);
}

export function alderTekst(dage: number) {
  if (dage <= 0) return "i dag";
  if (dage === 1) return "1 dag";
  if (dage < 30) return `${dage} dage`;
  const md = Math.floor(dage / 30);
  return md === 1 ? "1 måned" : `${md} måneder`;
}
