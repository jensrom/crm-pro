import "server-only";
import { db } from "@/lib/db";
import { aftalePeriode } from "@/lib/perioder";

export const subNr = (n: number | null | undefined) => (n == null ? "SUB-?????" : `SUB-${String(n).padStart(5, "0")}`);
/** Antal frie tekstlinjer på en ny ordrebekræftelse. */
export const ANTAL_FRIE_LINJER = 3;

export const ordreNr = (n: number) => `ORD-${String(n).padStart(5, "0")}`;
export const tilbudNr = (n: number) => `TIL-${String(n).padStart(5, "0")}`;
/** Nummeret på et tilbud eller en ordrebekræftelse */
export const dokNr = (o: { kind: string; number: number }) => (o.kind === "tilbud" ? tilbudNr(o.number) : ordreNr(o.number));
export const dokNavn = (kind: string) => (kind === "tilbud" ? "Tilbud" : "Ordrebekræftelse");

/**
 * Giver licenslinjer uden SUB-nummer det næste ledige. Kaldes før der vises
 * eller udstedes et licensbevis, så nye linjer altid har et nummer — uanset
 * om de er oprettet på kunden, via tilkøb eller af seed-scriptet.
 */
export async function sikrSubNumre(companyId?: string) {
  const uden = await db.customerProduct.findMany({
    where: { subNumber: null, ...(companyId ? { companyId } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!uden.length) return 0;
  const maks = await db.customerProduct.aggregate({ _max: { subNumber: true } });
  let n = maks._max.subNumber ?? 0;
  for (const l of uden) {
    await db.customerProduct.update({ where: { id: l.id }, data: { subNumber: ++n } });
  }
  return uden.length;
}

/**
 * Licensperioden på beviset: den aftaleperiode der dækker i dag (startdato +
 * aftaleperiode, eller udløbsdatoen hvis den er sat). Perpetual har ingen slutdato.
 */
export function foreslaaPeriode(
  linje: { startDate: Date; endDate: Date | null; termMonths?: number | null },
  licenseModel: string | null | undefined,
  nu = new Date()
): { fra: Date; til: Date | null } {
  if (licenseModel === "perpetual") return { fra: linje.startDate, til: linje.endDate };
  return aftalePeriode(linje, nu);
}

/** yyyy-mm-dd i lokal tid — til <input type="date">. */
export function isoDato(d: Date | null | undefined) {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-10-05" → Date (lokal middag, så tidszoner ikke flytter dagen). */
export function fraIsoDato(s: string | null | undefined): Date | null {
  const m = s?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type Afsender = {
  navn: string;
  afdeling: string | null;
  cvr: string | null;
  adresse: string | null;
  postby: string | null;
  land: string | null;
  mail: string | null;
  telefon: string | null;
  web: string | null;
  bank: string | null;
  betaling: string | null;
  moms: number;
  bevisTekst: string | null;
  ordreTekst: string | null;
  logo: string | null;
};

export async function hentAfsender(): Promise<Afsender> {
  const s = await db.settings.findUnique({ where: { id: "singleton" } });
  return {
    navn: s?.docCompanyName ?? "Afsender ikke udfyldt",
    afdeling: s?.docDepartment ?? null,
    cvr: s?.docCvr ?? null,
    adresse: s?.docAddress ?? null,
    postby: s?.docZipCity ?? null,
    land: s?.docCountry ?? null,
    mail: s?.docEmail ?? null,
    telefon: s?.docPhone ?? null,
    web: s?.docWebsite ?? null,
    bank: s?.docBankInfo ?? null,
    betaling: s?.docPaymentTerms ?? null,
    moms: s?.docVatRate ?? 25,
    bevisTekst: s?.docCertText ?? null,
    ordreTekst: s?.docOrderText ?? null,
    logo: s?.brandLogo ?? null,
  };
}

/** Filnavn uden tegn Windows ikke kan lide. */
export function filnavn(...dele: string[]) {
  return dele
    .join("_")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120) + ".pdf";
}
