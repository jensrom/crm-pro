"use server";

import { kraevLeads, kraevSkriv, kraevSuperAdmin } from "@/lib/auth";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { STADIER } from "@/lib/labels";
import { STADIE_SANDSYNLIGHED, afsluttetDage, erAfsluttet, stadieLabel } from "@/lib/pipeline";

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

/** Skriver en linje i kundens logbog, så bevægelser på salgssiden kan følges. */
async function logSalg(companyId: string, tekst: string, initialer: string | null) {
  await db.logEntry.create({
    data: { companyId, kind: "salg", content: tekst, author: initialer },
  });
}

function opfriskSalg(companyId: string) {
  revalidatePath("/leads");
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
  revalidatePath(`/kunder/${companyId}`);
}

export async function opretSag(formData: FormData) {
  const stage = txt(formData.get("stage")) ?? "ny";
  // Et lead må en Sælger selv oprette; alt længere fremme kræver skriveadgang til salg.
  const mig = stage === "ny" ? await kraevLeads() : await kraevSkriv("salg");
  const companyId = txt(formData.get("companyId"));
  const title = txt(formData.get("title"));
  if (!companyId || !title) return;
  const forventet = txt(formData.get("expectedCloseDate"));
  const afsluttet = erAfsluttet(stage);
  const sandsynlighed = num(formData.get("probability"));
  await db.deal.create({
    data: {
      companyId,
      title,
      productId: txt(formData.get("productId")),
      seatDelta: num(formData.get("seatDelta")) ?? null,
      value: num(formData.get("value")),
      stage,
      probability: Math.min(100, Math.max(0, Math.round(sandsynlighed ?? STADIE_SANDSYNLIGHED[stage] ?? 10))),
      expectedCloseDate: forventet ? new Date(forventet) : null,
      notes: txt(formData.get("notes")),
      nextStep: txt(formData.get("nextStep")),
      stageChangedAt: new Date(),
      closedAt: afsluttet ? new Date() : null,
    },
  });
  await logSalg(companyId, `Ny salgsmulighed: ${title} (${stadieLabel(stage)})`, mig.initials);
  opfriskSalg(companyId);
}

export async function flytStadie(id: string, stadie: string) {
  const mig = await kraevSkriv("salg");
  if (!STADIER.some((s) => s.key === stadie)) return;
  const foer = await db.deal.findUnique({ where: { id } });
  if (!foer || foer.stage === stadie) return;

  const afsluttet = erAfsluttet(stadie);
  // Rør kun sandsynligheden hvis den stadig står på standarden for det gamle
  // stadie — har du selv sat et tal, bliver det stående. Vundet/tabt er altid 100/0.
  const uroert = foer.probability === STADIE_SANDSYNLIGHED[foer.stage];
  const probability = afsluttet || uroert ? STADIE_SANDSYNLIGHED[stadie] : undefined;

  const d = await db.deal.update({
    where: { id },
    data: {
      stage: stadie,
      stageChangedAt: new Date(),
      closedAt: afsluttet ? new Date() : null,
      probability,
    },
  });
  await logSalg(d.companyId, `${d.title}: ${stadieLabel(foer.stage)} → ${stadieLabel(stadie)}`, mig.initials);
  opfriskSalg(d.companyId);
}

export async function opdaterSag(id: string, formData: FormData) {
  await kraevSkriv("salg");
  const title = txt(formData.get("title"));
  if (!title) return;
  const forventet = txt(formData.get("expectedCloseDate"));
  const sandsynlighed = num(formData.get("probability"));
  const d = await db.deal.update({
    where: { id },
    data: {
      title,
      productId: txt(formData.get("productId")),
      seatDelta: num(formData.get("seatDelta")),
      value: num(formData.get("value")),
      probability: sandsynlighed == null ? undefined : Math.min(100, Math.max(0, Math.round(sandsynlighed))),
      expectedCloseDate: forventet ? new Date(forventet) : null,
      nextStep: txt(formData.get("nextStep")),
      notes: txt(formData.get("notes")),
    },
  });
  opfriskSalg(d.companyId);
}

export async function sletSag(id: string) {
  const mig = await kraevSkriv("salg");
  const d = await db.deal.delete({ where: { id } });
  await logSalg(d.companyId, `Salgsmulighed slettet: ${d.title}`, mig.initials);
  opfriskSalg(d.companyId);
}

export async function opretAktivitet(formData: FormData) {
  await kraevSkriv("salg");
  const subject = txt(formData.get("subject"));
  if (!subject) return;
  const forfald = txt(formData.get("dueDate"));
  await db.activity.create({
    data: {
      type: txt(formData.get("type")) ?? "note",
      subject,
      description: txt(formData.get("description")),
      dueDate: forfald ? new Date(forfald) : null,
      companyId: txt(formData.get("companyId")),
      contactId: txt(formData.get("contactId")),
      dealId: txt(formData.get("dealId")),
    },
  });
  revalidatePath("/aktiviteter");
  revalidatePath("/dashboard");
  const k = txt(formData.get("companyId"));
  if (k) revalidatePath(`/kunder/${k}`);
}

export async function skiftAktivitet(id: string, faerdig: boolean) {
  await kraevSkriv("salg");
  const a = await db.activity.update({
    where: { id },
    data: { completedAt: faerdig ? new Date() : null },
  });
  revalidatePath("/aktiviteter");
  revalidatePath("/dashboard");
  if (a.companyId) revalidatePath(`/kunder/${a.companyId}`);
}

export async function sletAktivitet(id: string) {
  await kraevSkriv("salg");
  const a = await db.activity.delete({ where: { id } });
  revalidatePath("/aktiviteter");
  if (a.companyId) revalidatePath(`/kunder/${a.companyId}`);
}

export async function gemIndstillinger(formData: FormData) {
  await kraevSuperAdmin();
  const note = txt(formData.get("dataSourceNote"));
  await db.settings.upsert({
    where: { id: "singleton" },
    update: { dataSourceNote: note },
    create: { id: "singleton", dataSourceNote: note },
  });
  revalidatePath("/indstillinger");
  revalidatePath("/dashboard");
}

export async function gemPipelineIndstilling(formData: FormData) {
  await kraevSuperAdmin();
  const v = num(formData.get("pipelineDoneDays"));
  const dage = v == null ? null : afsluttetDage(v);
  await db.settings.upsert({
    where: { id: "singleton" },
    update: { pipelineDoneDays: dage },
    create: { id: "singleton", pipelineDoneDays: dage },
  });
  revalidatePath("/indstillinger");
  revalidatePath("/opportunities");
  revalidatePath("/kunder", "layout");
}
