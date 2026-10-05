import "server-only";
import { db } from "@/lib/db";

export const subNr = (n: number | null | undefined) => (n == null ? "SUB-?????" : `SUB-${String(n).padStart(5, "0")}`);
/** Antal frie tekstlinjer på en ny ordrebekræftelse. */
export const ANTAL_FRIE_LINJER = 3;

export const ordreNr = (n: number) => `ORD-${String(n).padStart(5, "0")}`;

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

const INTERVAL_MDR: Record<string, number> = { monthly: 1, quarterly: 3, biannual: 6, annual: 12 };
export const intervalMaaneder = (i: string | null | undefined) => INTERVAL_MDR[i ?? "annual"] ?? 12;

function plusMaaneder(d: Date, m: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

/**
 * Foreslår licensperioden der dækker i dag: fra linjens startdato frem i
 * faktureringsintervaller. Perpetual har ingen slutdato. Har linjen en
 * slutdato, er det den der gælder som yderste grænse.
 */
export function foreslaaPeriode(
  linje: { startDate: Date; endDate: Date | null; billingInterval: string },
  licenseModel: string | null | undefined,
  nu = new Date()
): { fra: Date; til: Date | null } {
  const start = new Date(linje.startDate);
  start.setHours(0, 0, 0, 0);
  if (licenseModel === "perpetual") return { fra: start, til: linje.endDate };

  const m = intervalMaaneder(linje.billingInterval);
  let fra = start;
  let naeste = plusMaaneder(fra, m);
  let vagt = 0;
  while (naeste <= nu && vagt++ < 1000) {
    fra = naeste;
    naeste = plusMaaneder(fra, m);
  }
  const til = new Date(naeste);
  til.setDate(til.getDate() - 1);
  if (linje.endDate && linje.endDate < til) return { fra, til: linje.endDate };
  return { fra, til };
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
