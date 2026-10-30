"use server";

/**
 * Notater — opgavetavlen med kolonnerne Nu, Næste, Venter og Færdig, delt i
 * sporene salg og teknik. Et notat kan hænge på en kunde, men behøver ikke.
 */
import { db } from "@/lib/db";
import { kraevAdmin, kraevBruger, kraevLeads, kraevSkriv } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { formular, type Formular } from "@/lib/formular";
import { NOTAT_KOLONNER, NOTAT_PRIORITET } from "@/lib/labels";

const KOLONNER: string[] = NOTAT_KOLONNER.map((k) => k.key);
// Teknikdelen er fjernet: alle nye notater er salgsnotater
const spor = (_f: Formular) => "salg";

/**
 * Notater kræver Sælger-adgang (leads) eller skriveadgang til salg. Gamle
 * tekniknotater fra før teknikdelen blev fjernet, kan kun ændres af administratorer.
 */
async function kraevSpor(track: string | null | undefined) {
  return track === "teknik" ? kraevAdmin() : kraevLeads();
}

async function kraevNotat(id: string) {
  const n = await db.customerNote.findUnique({ where: { id }, select: { track: true } });
  return kraevSpor(n?.track);
}

function opfrisk(kundeId?: string | null) {
  revalidatePath("/notater");
  revalidatePath("/dashboard");
  if (kundeId) revalidatePath(`/kunder/${kundeId}`);
}

/** Nye kort lægger sig øverst i kolonnen. */
async function oeversteHul(lane: string) {
  const foerste = await db.customerNote.findFirst({
    where: { lane },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  return (foerste?.position ?? 0) - 1;
}

export async function opretNotat(formData: FormData) {
  const f = formular(formData);
  const mig = await kraevSpor(spor(f));
  const title = f.tekst("title");
  if (!title) return;
  const lane = f.valg("lane", KOLONNER, "nu");

  await db.customerNote.create({
    data: {
      title,
      details: f.tekst("details"),
      companyId: f.tekst("companyId"),
      lane,
      position: await oeversteHul(lane),
      track: spor(f),
      priority: f.valg("priority", NOTAT_PRIORITET, "normal"),
      dueAt: f.dato("dueAt"),
      completedAt: lane === "faerdig" ? new Date() : null,
      author: mig.initials,
    },
  });
  opfrisk(f.tekst("companyId"));
}

export async function gemNotat(id: string, formData: FormData) {
  const f = formular(formData);
  await kraevNotat(id);
  await kraevSpor(spor(f));
  const lane = f.valg("lane", KOLONNER, "nu");
  const nuvaerende = await db.customerNote.findUnique({ where: { id }, select: { completedAt: true } });
  if (!nuvaerende) return;

  const n = await db.customerNote.update({
    where: { id },
    data: {
      title: f.tekst("title") ?? "Uden titel",
      details: f.tekst("details"),
      companyId: f.tekst("companyId"),
      lane,
      track: spor(f),
      priority: f.valg("priority", NOTAT_PRIORITET, "normal"),
      dueAt: f.dato("dueAt"),
      completedAt: lane === "faerdig" ? nuvaerende.completedAt ?? new Date() : null,
    },
  });
  opfrisk(n.companyId);
}

/** Afkrydsning. Færdige kort flytter selv over i Færdig-kolonnen. */
export async function skiftFaerdig(id: string, faerdig: boolean) {
  await kraevNotat(id);
  const n = await db.customerNote.update({
    where: { id },
    data: faerdig
      ? { completedAt: new Date(), lane: "faerdig", position: await oeversteHul("faerdig") }
      : { completedAt: null, lane: "nu", position: await oeversteHul("nu") },
  });
  opfrisk(n.companyId);
}

/**
 * Flytter et kort til en kolonne og en plads i rækkefølgen.
 * Positionerne skrives om for hele kolonnen, så de altid er sammenhængende.
 */
export async function flytNotat(id: string, lane: string, indeks: number) {
  await kraevNotat(id);
  if (!KOLONNER.includes(lane)) return;

  const kort = await db.customerNote.findUnique({ where: { id } });
  if (!kort) return;

  await db.$transaction(async (tx) => {
    await tx.customerNote.update({
      where: { id },
      data: { lane, completedAt: lane === "faerdig" ? kort.completedAt ?? new Date() : null },
    });
    const iKolonnen = await tx.customerNote.findMany({ where: { lane, NOT: { id } }, orderBy: { position: "asc" }, select: { id: true } });
    const raekkefoelge = iKolonnen.map((k) => k.id);
    raekkefoelge.splice(Math.max(0, Math.min(Math.trunc(indeks) || 0, raekkefoelge.length)), 0, id);
    for (const [i, kortId] of raekkefoelge.entries()) {
      await tx.customerNote.update({ where: { id: kortId }, data: { position: i } });
    }
  });

  opfrisk(kort.companyId);
}

export async function sletNotat(id: string) {
  // Kun Administrator og Superadministrator kan slette
  await kraevAdmin();
  const n = await db.customerNote.delete({ where: { id } });
  opfrisk(n.companyId);
}

/** Rydder Færdig-kolonnen. */
export async function ryddFaerdige() {
  await kraevAdmin();
  await db.customerNote.deleteMany({ where: { lane: "faerdig" } });
  opfrisk();
}

/** Rydder Færdig-kolonnen for én kunde. */
export async function ryddFaerdigeForKunde(kundeId: string) {
  // Kun Administrator og Superadministrator kan slette
  const mig = await kraevAdmin();
  // Ryd kun de spor brugeren selv må skrive i.
  const spor = [
    ...(mig.ret.leads || mig.ret.salg === "skriv" ? ["salg"] : []),
  ];
  if (spor.length === 0) return;
  await db.customerNote.deleteMany({ where: { lane: "faerdig", companyId: kundeId, track: { in: spor } } });
  opfrisk(kundeId);
}
