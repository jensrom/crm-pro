/**
 * Intern salg — forløbet for en godkendt ordre, efter kunden har sagt ja:
 *
 *   Pending → Bestilt → Afventer leverandør → Klar til kunde → Leveret & afsluttet
 *
 * Fra "Klar til kunde" kan der laves licensbevis. Afsluttede ordrer ligger i
 * deres egen pulje og tæller med i leveringsopgørelsen (internAfsluttetAt).
 * Ren logik uden databasekald — bruges både i UI og i handlingerne.
 */

export const INTERN_STATUS = [
  { key: "pending", label: "Pending", kort: "Pending", variant: "info" as const, tidsfelt: "internSentAt" },
  { key: "bestilt", label: "Bestilt", kort: "Bestilt", variant: "default" as const, tidsfelt: "internBestiltAt" },
  { key: "afventer", label: "Afventer leverandør", kort: "Afventer", variant: "warning" as const, tidsfelt: "internAfventerAt" },
  { key: "klar", label: "Klar til kunde", kort: "Klar", variant: "success" as const, tidsfelt: "internKlarAt" },
  { key: "afsluttet", label: "Leveret & afsluttet", kort: "Afsluttet", variant: "muted" as const, tidsfelt: "internAfsluttetAt" },
] as const;

export type InternStatus = (typeof INTERN_STATUS)[number]["key"];
export const AKTIVE_INTERN: InternStatus[] = ["pending", "bestilt", "afventer", "klar"];

export const findInternStatus = (k: string | null | undefined) => INTERN_STATUS.find((s) => s.key === k) ?? null;
export const erInternStatus = (k: string | null | undefined): k is InternStatus => !!findInternStatus(k);

/** Licensbevis kan laves, når varen er klar til kunden (og efter). */
export const kanLaveLicensbevis = (k: string | null | undefined) => k === "klar" || k === "afsluttet";

export function naesteInternStatus(k: string | null | undefined): InternStatus | null {
  const i = INTERN_STATUS.findIndex((s) => s.key === k);
  return i >= 0 && i < INTERN_STATUS.length - 1 ? INTERN_STATUS[i + 1].key : null;
}

// ---------- Perioder til leveringsopgørelsen ----------

export const PERIODER = [
  { key: "maaned", label: "Denne måned" },
  { key: "sidste", label: "Sidste måned" },
  { key: "kvartal", label: "Dette kvartal" },
  { key: "aar", label: "I år" },
  { key: "12m", label: "Seneste 12 mdr." },
  { key: "egen", label: "Egne datoer" },
] as const;

const start = (y: number, m: number, d = 1) => new Date(y, m, d, 0, 0, 0, 0);
const slut = (y: number, m: number, d: number) => new Date(y, m, d, 23, 59, 59, 999);

/** Fra–til for en preset (eller egne datoer "yyyy-mm-dd"). Til er inklusiv hele dagen. */
export function periodeFra(key: string | undefined, fra?: string, til?: string, nu = new Date()) {
  const y = nu.getFullYear(), m = nu.getMonth();
  const iso = (s?: string) => {
    const x = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return x ? [Number(x[1]), Number(x[2]) - 1, Number(x[3])] as const : null;
  };
  switch (key) {
    case "sidste": return { key, fra: start(y, m - 1), til: slut(y, m, 0) };
    case "kvartal": { const q = Math.floor(m / 3) * 3; return { key, fra: start(y, q), til: slut(y, q + 3, 0) }; }
    case "aar": return { key, fra: start(y, 0), til: slut(y, 11, 31) };
    case "12m": return { key, fra: start(y, m - 11), til: slut(y, m + 1, 0) };
    case "egen": {
      const f = iso(fra), t = iso(til);
      if (f && t) return { key, fra: start(f[0], f[1], f[2]), til: slut(t[0], t[1], t[2]) };
      return { key: "maaned", fra: start(y, m), til: slut(y, m + 1, 0) };
    }
    default: return { key: "maaned", fra: start(y, m), til: slut(y, m + 1, 0) };
  }
}
