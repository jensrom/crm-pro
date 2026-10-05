"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { hentSession, kraevBruger } from "@/lib/auth";
import { redirect } from "next/navigation";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  if (s == null) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const heltal = (v: FormDataEntryValue | null) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};
const dato = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  return s ? new Date(s) : null;
};

function opfrisk(kundeId?: string | null, sagId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/teknik");
  revalidatePath("/teknik/sager");
  revalidatePath("/teknik/klippekort");
  if (kundeId) revalidatePath(`/kunder/${kundeId}`);
  if (sagId) revalidatePath(`/teknik/sager/${sagId}`);
}

/** Næste ledige nummer i en fortløbende serie. */
async function naesteSagsnummer() {
  const sidste = await db.ticket.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (sidste?.number ?? 0) + 1;
}
async function naesteKortnummer() {
  const sidste = await db.hourBundle.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (sidste?.number ?? 0) + 1;
}

// ============================================================
// SAGER
// ============================================================

export async function opretSag(formData: FormData) {
  await kraevBruger();
  const companyId = txt(formData.get("companyId"));
  const title = txt(formData.get("title"));
  if (!companyId || !title) return;

  const sag = await db.ticket.create({
    data: {
      number: await naesteSagsnummer(),
      companyId,
      contactId: txt(formData.get("contactId")),
      productId: txt(formData.get("productId")),
      title,
      description: txt(formData.get("description")),
      status: txt(formData.get("status")) ?? "aaben",
      priority: txt(formData.get("priority")) ?? "normal",
      dueAt: dato(formData.get("dueAt")),
    },
  });
  opfrisk(companyId, sag.id);
  redirect(`/teknik/sager/${sag.id}`);
}

export async function gemSag(id: string, formData: FormData) {
  await kraevBruger();
  const status = txt(formData.get("status")) ?? "aaben";
  const nu = new Date();
  const sag = await db.ticket.update({
    where: { id },
    data: {
      title: txt(formData.get("title")) ?? "Uden titel",
      description: txt(formData.get("description")),
      status,
      priority: txt(formData.get("priority")) ?? "normal",
      contactId: txt(formData.get("contactId")),
      productId: txt(formData.get("productId")),
      dueAt: dato(formData.get("dueAt")),
      resolvedAt: status === "loest" || status === "lukket" ? nu : null,
      closedAt: status === "lukket" ? nu : null,
    },
  });
  opfrisk(sag.companyId, sag.id);
}

/** Hurtigt statusskift fra en liste, uden at åbne sagen. */
export async function skiftSagsstatus(id: string, status: string) {
  await kraevBruger();
  const nu = new Date();
  const sag = await db.ticket.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "loest" || status === "lukket" ? nu : null,
      closedAt: status === "lukket" ? nu : null,
    },
  });
  opfrisk(sag.companyId, sag.id);
}

export async function sletSag(id: string) {
  await kraevBruger();
  const sag = await db.ticket.delete({ where: { id } });
  opfrisk(sag.companyId);
  redirect("/teknik/sager");
}

export async function skrivKommentar(sagId: string, formData: FormData) {
  await kraevBruger();
  const content = txt(formData.get("content"));
  if (!content) return;
  const mig = await hentSession();
  await db.ticketComment.create({
    data: {
      ticketId: sagId,
      content,
      isInternal: formData.get("isInternal") === "on",
      author: mig?.initials ?? null,
    },
  });
  revalidatePath(`/teknik/sager/${sagId}`);
}

export async function sletKommentar(id: string, sagId: string) {
  await kraevBruger();
  await db.ticketComment.delete({ where: { id } });
  revalidatePath(`/teknik/sager/${sagId}`);
}

// ============================================================
// KLIPPEKORT
// ============================================================

export async function opretKlippekort(formData: FormData) {
  await kraevBruger();
  const companyId = txt(formData.get("companyId"));
  const timer = num(formData.get("totalHours"));
  if (!companyId || timer == null || timer <= 0) return;

  await db.hourBundle.create({
    data: {
      number: await naesteKortnummer(),
      companyId,
      name: txt(formData.get("name")),
      totalHours: timer,
      price: num(formData.get("price")),
      purchaseDate: dato(formData.get("purchaseDate")) ?? new Date(),
      expiresAt: dato(formData.get("expiresAt")),
      notes: txt(formData.get("notes")),
    },
  });
  opfrisk(companyId);
}

export async function gemKlippekort(id: string, formData: FormData) {
  await kraevBruger();
  const kort = await db.hourBundle.update({
    where: { id },
    data: {
      name: txt(formData.get("name")),
      totalHours: num(formData.get("totalHours")) ?? 0,
      price: num(formData.get("price")),
      purchaseDate: dato(formData.get("purchaseDate")) ?? undefined,
      expiresAt: dato(formData.get("expiresAt")),
      notes: txt(formData.get("notes")),
      isActive: formData.get("isActive") === "on",
    },
  });
  opfrisk(kort.companyId);
}

export async function sletKlippekort(id: string) {
  await kraevBruger();
  // Tidsposterne slippes fri i stedet for at forsvinde — timerne er stadig brugt.
  await db.timeLog.updateMany({ where: { bundleId: id }, data: { bundleId: null } });
  const kort = await db.hourBundle.delete({ where: { id } });
  opfrisk(kort.companyId);
}

// ============================================================
// TID
// ============================================================

/** Genberegner et klippekorts forbrug ud fra de tidsposter der peger på det. */
async function opdaterForbrug(bundleId: string | null | undefined) {
  if (!bundleId) return;
  const sum = await db.timeLog.aggregate({
    where: { bundleId },
    _sum: { durationMin: true },
  });
  await db.hourBundle.update({
    where: { id: bundleId },
    data: { usedMinutes: sum._sum.durationMin ?? 0 },
  });
}

export async function registrerTid(formData: FormData) {
  await kraevBruger();
  const companyId = txt(formData.get("companyId"));
  const minutter = heltal(formData.get("durationMin"));
  if (!companyId || minutter == null || minutter <= 0) return;

  const bundleId = txt(formData.get("bundleId"));
  const ticketId = txt(formData.get("ticketId"));

  await db.timeLog.create({
    data: {
      companyId,
      ticketId,
      bundleId,
      date: dato(formData.get("date")) ?? new Date(),
      durationMin: minutter,
      description: txt(formData.get("description")),
      isBillable: formData.get("isBillable") !== "off",
    },
  });
  await opdaterForbrug(bundleId);
  opfrisk(companyId, ticketId);
}

export async function sletTid(id: string) {
  await kraevBruger();
  const post = await db.timeLog.delete({ where: { id } });
  await opdaterForbrug(post.bundleId);
  opfrisk(post.companyId, post.ticketId);
}

// ============================================================
// LOGBOG
// ============================================================

export async function skrivLog(kundeId: string, formData: FormData) {
  await kraevBruger();
  const content = txt(formData.get("content"));
  if (!content) return;
  const mig = await hentSession();
  await db.logEntry.create({
    data: {
      companyId: kundeId,
      kind: txt(formData.get("kind")) ?? "note",
      content,
      author: mig?.initials ?? null,
    },
  });
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/dashboard");
}

export async function skiftFastgjort(id: string, kundeId: string, fastgjort: boolean) {
  await kraevBruger();
  await db.logEntry.update({ where: { id }, data: { pinned: fastgjort } });
  revalidatePath(`/kunder/${kundeId}`);
}

export async function sletLog(id: string, kundeId: string) {
  await kraevBruger();
  await db.logEntry.delete({ where: { id } });
  revalidatePath(`/kunder/${kundeId}`);
}
