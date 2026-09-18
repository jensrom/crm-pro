"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

export async function opretSag(formData: FormData) {
  const companyId = txt(formData.get("companyId"));
  const title = txt(formData.get("title"));
  if (!companyId || !title) return;
  const forventet = txt(formData.get("expectedCloseDate"));
  await db.deal.create({
    data: {
      companyId,
      title,
      productId: txt(formData.get("productId")),
      seatDelta: num(formData.get("seatDelta")) ?? null,
      value: num(formData.get("value")),
      stage: txt(formData.get("stage")) ?? "ny",
      probability: Math.min(100, Math.max(0, Math.round(num(formData.get("probability")) ?? 10))),
      expectedCloseDate: forventet ? new Date(forventet) : null,
      notes: txt(formData.get("notes")),
    },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/kunder/${companyId}`);
  revalidatePath("/dashboard");
}

export async function flytStadie(id: string, stadie: string) {
  const afsluttet = stadie === "vundet" || stadie === "tabt";
  const d = await db.deal.update({
    where: { id },
    data: {
      stage: stadie,
      closedAt: afsluttet ? new Date() : null,
      probability: stadie === "vundet" ? 100 : stadie === "tabt" ? 0 : undefined,
    },
  });
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath(`/kunder/${d.companyId}`);
}

export async function sletSag(id: string) {
  await db.deal.delete({ where: { id } });
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
}

export async function opretAktivitet(formData: FormData) {
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
  const a = await db.activity.update({
    where: { id },
    data: { completedAt: faerdig ? new Date() : null },
  });
  revalidatePath("/aktiviteter");
  revalidatePath("/dashboard");
  if (a.companyId) revalidatePath(`/kunder/${a.companyId}`);
}

export async function sletAktivitet(id: string) {
  const a = await db.activity.delete({ where: { id } });
  revalidatePath("/aktiviteter");
  if (a.companyId) revalidatePath(`/kunder/${a.companyId}`);
}

export async function gemIndstillinger(formData: FormData) {
  const note = txt(formData.get("dataSourceNote"));
  await db.settings.upsert({
    where: { id: "singleton" },
    update: { dataSourceNote: note },
    create: { id: "singleton", dataSourceNote: note },
  });
  revalidatePath("/indstillinger");
  revalidatePath("/dashboard");
}
