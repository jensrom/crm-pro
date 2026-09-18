"use server";

import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const dato = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  return s ? new Date(s) : null;
};

const KOLONNER = ["nu", "naeste", "venter", "faerdig"];

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
  const title = txt(formData.get("title"));
  if (!title) return;
  const lane = KOLONNER.includes(String(formData.get("lane"))) ? String(formData.get("lane")) : "nu";
  const mig = await hentSession();

  await db.customerNote.create({
    data: {
      title,
      details: txt(formData.get("details")),
      companyId: txt(formData.get("companyId")),
      lane,
      position: await oeversteHul(lane),
      track: formData.get("track") === "teknik" ? "teknik" : "salg",
      priority: txt(formData.get("priority")) ?? "normal",
      dueAt: dato(formData.get("dueAt")),
      completedAt: lane === "faerdig" ? new Date() : null,
      author: mig?.initials ?? null,
    },
  });
  opfrisk(txt(formData.get("companyId")));
}

export async function gemNotat(id: string, formData: FormData) {
  const lane = KOLONNER.includes(String(formData.get("lane"))) ? String(formData.get("lane")) : "nu";
  const nuvaerende = await db.customerNote.findUnique({ where: { id }, select: { completedAt: true } });

  const n = await db.customerNote.update({
    where: { id },
    data: {
      title: txt(formData.get("title")) ?? "Uden titel",
      details: txt(formData.get("details")),
      companyId: txt(formData.get("companyId")),
      lane,
      track: formData.get("track") === "teknik" ? "teknik" : "salg",
      priority: txt(formData.get("priority")) ?? "normal",
      dueAt: dato(formData.get("dueAt")),
      completedAt: lane === "faerdig" ? nuvaerende?.completedAt ?? new Date() : null,
    },
  });
  opfrisk(n.companyId);
}

/** Afkrydsning. Færdige kort flytter selv over i Færdig-kolonnen. */
export async function skiftFaerdig(id: string, faerdig: boolean) {
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
  if (!KOLONNER.includes(lane)) return;

  const kort = await db.customerNote.findUnique({ where: { id } });
  if (!kort) return;

  await db.customerNote.update({
    where: { id },
    data: {
      lane,
      completedAt: lane === "faerdig" ? kort.completedAt ?? new Date() : null,
    },
  });

  const iKolonnen = await db.customerNote.findMany({
    where: { lane, NOT: { id } },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const raekkefoelge = [...iKolonnen.map((k) => k.id)];
  raekkefoelge.splice(Math.max(0, Math.min(indeks, raekkefoelge.length)), 0, id);

  await db.$transaction(
    raekkefoelge.map((kortId, i) =>
      db.customerNote.update({ where: { id: kortId }, data: { position: i } })
    )
  );

  opfrisk(kort.companyId);
}

export async function sletNotat(id: string) {
  const n = await db.customerNote.delete({ where: { id } });
  opfrisk(n.companyId);
}

/** Rydder Færdig-kolonnen. */
export async function ryddFaerdige() {
  await db.customerNote.deleteMany({ where: { lane: "faerdig" } });
  opfrisk();
}
