import "server-only";
import { db } from "@/lib/db";
import { aftaleUdloeb, dagStart, maanederMellem } from "@/lib/perioder";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Klient = typeof db | Tx;

/**
 * SUB-nøglen er kontrakten med kunden. Licenslinjerne ligger under den, og
 * et tilkøb følger nøglens udløb. Her ligger reglerne for nøgler og restpris.
 */

/** Næste ledige SUB-nummer. Tager også de gamle linjenumre med, så ingen nøgle genbruger et nummer. */
export async function naesteSubNummer(k: Klient = db) {
  const [c, l] = await Promise.all([
    k.contract.aggregate({ _max: { subNumber: true } }),
    k.customerProduct.aggregate({ _max: { subNumber: true } }),
  ]);
  return Math.max(c._max.subNumber ?? 0, l._max.subNumber ?? 0) + 1;
}

/** Opretter en ny, tom SUB-nøgle på kunden. */
export async function opretKontrakt(k: Klient, companyId: string, initials: string | null, name?: string | null) {
  return k.contract.create({
    data: { companyId, subNumber: await naesteSubNummer(k), name: name ?? null, updatedBy: initials },
  });
}

/**
 * Giver licenslinjer uden SUB-nøgle hver sin. En linje der allerede havde et
 * SUB-nummer, beholder det som nøgle, så numre på udstedte licensbeviser stadig
 * passer. Kan kaldes igen og igen — den laver kun det, der mangler.
 */
export async function sikrKontrakter(companyId?: string) {
  const uden = await db.customerProduct.findMany({
    where: { contractId: null, ...(companyId ? { companyId } : {}) },
    orderBy: [{ subNumber: "asc" }, { createdAt: "asc" }],
    select: { id: true, companyId: true, subNumber: true },
  });
  let n = 0;
  for (const l of uden) {
    try {
      await db.$transaction(async (tx) => {
        const optaget = l.subNumber != null && (await tx.contract.findUnique({ where: { subNumber: l.subNumber } }));
        const nr = l.subNumber != null && !optaget ? l.subNumber : await naesteSubNummer(tx);
        const k = await tx.contract.create({ data: { companyId: l.companyId, subNumber: nr } });
        await tx.customerProduct.update({ where: { id: l.id }, data: { contractId: k.id } });
      });
      n++;
    } catch {
      // To samtidige sidevisninger kan nå at tage samme nummer — den anden prøver igen næste gang.
    }
  }
  return n;
}

/** Fjerner kundens nøgler uden linjer og uden dokumenter. Bruges efter en linje er flyttet til en anden nøgle. */
export async function ryddTommeKontrakter(companyId: string) {
  await db.contract.deleteMany({ where: { companyId, lines: { none: {} }, orders: { none: {} } } });
}

type LinjeMedProdukt = {
  startDate: Date;
  endDate: Date | null;
  termMonths: number;
  isActive: boolean;
  product: { licenseModel: string };
};

const erAbonnement = (l: LinjeMedProdukt) => l.isActive && l.product.licenseModel !== "perpetual" && l.product.licenseModel !== "fee";

/** Nøglens udløb: det seneste udløb blandt dens aktive abonnementslinjer. Null = ingen abonnementer. */
export function kontraktUdloeb(linjer: LinjeMedProdukt[], nu = new Date()): Date | null {
  const datoer = linjer.filter(erAbonnement).map((l) => aftaleUdloeb(l, nu));
  if (!datoer.length) return null;
  return datoer.reduce((a, b) => (b > a ? b : a));
}

/** Nøglens aftaleperiode i måneder — den længste blandt abonnementslinjerne. */
export function kontraktTerm(linjer: LinjeMedProdukt[]) {
  const t = linjer.filter(erAbonnement).map((l) => l.termMonths);
  return t.length ? Math.max(...t) : 12;
}

/** Har nøglens abonnementslinjer forskellige udløb? Så skal brugeren se det. */
export function forskelligeUdloeb(linjer: LinjeMedProdukt[], nu = new Date()) {
  const s = new Set(linjer.filter(erAbonnement).map((l) => aftaleUdloeb(l, nu).toDateString()));
  return s.size > 1;
}

/**
 * Restperioden for et tilkøb: fra start til udløbet. Påbegyndte måneder tæller
 * som hele (14. maj → 31. dec. = 8 måneder). Null = nøglen er udløbet.
 */
export function restperiode(start: Date, udloeb: Date) {
  const fra = dagStart(start);
  const til = dagStart(udloeb);
  if (til < fra) return null;
  return { fra, til, maaneder: maanederMellem(fra, til) };
}
