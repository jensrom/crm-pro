const da = "da-DK";

export const tal = (n: number | null | undefined, decimaler = 0) =>
  n == null ? "–" : new Intl.NumberFormat(da, { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler }).format(n);

export const kroner = (n: number | null | undefined) =>
  n == null ? "–" : new Intl.NumberFormat(da, { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n);

export const millioner = (n: number | null | undefined) =>
  n == null ? "–" : `${tal(n, 1)} mio. kr.`;

export const procent = (n: number | null | undefined, decimaler = 0) =>
  n == null ? "–" : `${tal(n * 100, decimaler)} %`;

export const dato = (d: Date | string | null | undefined) =>
  d == null ? "–" : new Intl.DateTimeFormat(da, { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export const datoKort = (d: Date | string | null | undefined) =>
  d == null ? "–" : new Intl.DateTimeFormat(da, { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(d));

/** Sortering der respekterer dansk alfabet (Æ, Ø, Å sidst). */
export const daSort = (a: string, b: string) => a.localeCompare(b, da);

/** Klokkeslæt alene: 14:32 */
export const klokken = (d: Date | string | null | undefined) =>
  d == null ? "–" : new Intl.DateTimeFormat(da, { hour: "2-digit", minute: "2-digit" }).format(new Date(d));

/**
 * Tidspunkt skrevet som man siger det: "i dag 14:32", "i går 09:10",
 * ellers "26. aug. 14:32" — og med årstal hvis det er et andet år.
 */
export function tidspunkt(d: Date | string | null | undefined) {
  if (d == null) return "–";
  const t = new Date(d);
  const nu = new Date();
  const dag = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const doegn = Math.round((dag(nu) - dag(t)) / 86_400_000);

  if (doegn === 0) return `i dag ${klokken(t)}`;
  if (doegn === 1) return `i går ${klokken(t)}`;

  const medAar = t.getFullYear() !== nu.getFullYear();
  const d1 = new Intl.DateTimeFormat(da, {
    day: "numeric",
    month: "short",
    ...(medAar ? { year: "numeric" } : {}),
  }).format(t);
  return `${d1} ${klokken(t)}`;
}
