"use server";

/**
 * Teknik: sager (med kommentarer), klippekort, tidsregistrering og kundens logbog.
 */
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kraevAdmin, kraevLogbog, kraevSkriv, kraevTid, kraevSuperAdmin } from "@/lib/auth";
import { formular } from "@/lib/formular";
import { LOGTYPER, SAGSPRIORITET, SAGSSTATUS } from "@/lib/labels";
import { medLoebenummer } from "@/lib/nummerserie";

function opfrisk(kundeId?: string | null, sagId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/teknik");
  revalidatePath("/teknik/sager");
  revalidatePath("/teknik/klippekort");
  if (kundeId) revalidatePath(`/kunder/${kundeId}`);
  if (sagId) revalidatePath(`/teknik/sager/${sagId}`);
}

const naesteSagsnummer = async () => ((await db.ticket.aggregate({ _max: { number: true } }))._max.number ?? 0) + 1;
const naesteKortnummer = async () => ((await db.hourBundle.aggregate({ _max: { number: true } }))._max.number ?? 0) + 1;

/**
 * Løst/lukket-tidspunkterne. Et tidspunkt der allerede står, bevares — så
 * en sag der gemmes igen, ikke får en ny løst-dato hver gang.
 */
function statusTider(status: string, foer?: { resolvedAt: Date | null; closedAt: Date | null } | null) {
  const nu = new Date();
  const loest = status === "loest" || status === "lukket";
  return {
    resolvedAt: loest ? foer?.resolvedAt ?? nu : null,
    closedAt: status === "lukket" ? foer?.closedAt ?? nu : null,
  };
}

/** Kontakt og produkt skal høre til kunden/kataloget — ellers gemmes de ikke. */
async function gyldigKontakt(companyId: string, contactId: string | null) {
  if (!contactId) return null;
  const k = await db.contact.findFirst({ where: { id: contactId, companyId }, select: { id: true } });
  return k?.id ?? null;
}
async function gyldigtProdukt(productId: string | null) {
  if (!productId) return null;
  const p = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  return p?.id ?? null;
}

// ============================================================
// SAGER
// ============================================================

export async function opretSag(formData: FormData) {
  await kraevSkriv("teknik");
  const f = formular(formData);
  const companyId = f.tekst("companyId");
  const title = f.tekst("title");
  if (!companyId || !title) return;

  const status = f.valg("status", SAGSSTATUS, "aaben");
  const [contactId, productId] = await Promise.all([gyldigKontakt(companyId, f.tekst("contactId")), gyldigtProdukt(f.tekst("productId"))]);
  const sag = await medLoebenummer(naesteSagsnummer, (number) =>
    db.ticket.create({
      data: {
        number,
        companyId,
        contactId,
        productId,
        title,
        description: f.tekst("description"),
        status,
        priority: f.valg("priority", SAGSPRIORITET, "normal"),
        dueAt: f.dato("dueAt"),
        ...statusTider(status),
      },
    })
  );
  opfrisk(companyId, sag.id);
  redirect(`/teknik/sager/${sag.id}`);
}

export async function gemSag(id: string, formData: FormData) {
  await kraevSkriv("teknik");
  const f = formular(formData);
  const foer = await db.ticket.findUnique({ where: { id }, select: { companyId: true, resolvedAt: true, closedAt: true } });
  if (!foer) return;
  const status = f.valg("status", SAGSSTATUS, "aaben");
  const [contactId, productId] = await Promise.all([gyldigKontakt(foer.companyId, f.tekst("contactId")), gyldigtProdukt(f.tekst("productId"))]);
  const sag = await db.ticket.update({
    where: { id },
    data: {
      title: f.tekst("title") ?? "Uden titel",
      description: f.tekst("description"),
      status,
      priority: f.valg("priority", SAGSPRIORITET, "normal"),
      contactId,
      productId,
      dueAt: f.dato("dueAt"),
      ...statusTider(status, foer),
    },
  });
  opfrisk(sag.companyId, sag.id);
}

/** Hurtigt statusskift fra en liste, uden at åbne sagen. */
export async function skiftSagsstatus(id: string, status: string) {
  await kraevSkriv("teknik");
  if (!SAGSSTATUS.some((s) => s.key === status)) return;
  const foer = await db.ticket.findUnique({ where: { id }, select: { resolvedAt: true, closedAt: true } });
  if (!foer) return;
  const sag = await db.ticket.update({ where: { id }, data: { status, ...statusTider(status, foer) } });
  opfrisk(sag.companyId, sag.id);
}

export async function sletSag(id: string) {
  // Kun Administrator og Superadministrator kan slette
  await kraevAdmin();
  // Tid registreret på sagen bliver stående på kunden (og kortet) — kun koblingen til sagen fjernes.
  const sag = await db.$transaction(async (tx) => {
    await tx.timeLog.updateMany({ where: { ticketId: id }, data: { ticketId: null } });
    return tx.ticket.delete({ where: { id } });
  });
  opfrisk(sag.companyId);
  redirect("/teknik/sager");
}

export async function skrivKommentar(sagId: string, formData: FormData) {
  const mig = await kraevSkriv("teknik");
  const f = formular(formData);
  const content = f.tekst("content");
  if (!content) return;
  await db.ticketComment.create({
    data: { ticketId: sagId, content, isInternal: f.flueben("isInternal"), author: mig.initials },
  });
  revalidatePath(`/teknik/sager/${sagId}`);
}

export async function sletKommentar(id: string, sagId: string) {
  // Kun Administrator og Superadministrator kan slette
  await kraevAdmin();
  await db.ticketComment.deleteMany({ where: { id, ticketId: sagId } });
  revalidatePath(`/teknik/sager/${sagId}`);
}

// ============================================================
// KLIPPEKORT
// ============================================================

export async function opretKlippekort(formData: FormData) {
  await kraevSkriv("teknik");
  const f = formular(formData);
  const companyId = f.tekst("companyId");
  const timer = f.tal("totalHours");
  if (!companyId || timer == null || timer <= 0) return;

  await medLoebenummer(naesteKortnummer, (number) =>
    db.hourBundle.create({
      data: {
        number,
        companyId,
        name: f.tekst("name"),
        totalHours: timer,
        price: f.tal("price"),
        purchaseDate: f.dato("purchaseDate") ?? new Date(),
        expiresAt: f.dato("expiresAt"),
        notes: f.tekst("notes"),
      },
    })
  );
  opfrisk(companyId);
}

export async function gemKlippekort(id: string, formData: FormData) {
  await kraevSkriv("teknik");
  const f = formular(formData);
  const timer = f.tal("totalHours");
  const kort = await db.hourBundle.update({
    where: { id },
    data: {
      name: f.tekst("name"),
      // Et tomt eller ugyldigt timetal ændrer ikke kortet
      ...(timer != null && timer > 0 ? { totalHours: timer } : {}),
      price: f.tal("price"),
      ...(f.dato("purchaseDate") ? { purchaseDate: f.dato("purchaseDate")! } : {}),
      expiresAt: f.dato("expiresAt"),
      notes: f.tekst("notes"),
      isActive: f.flueben("isActive"),
    },
  });
  opfrisk(kort.companyId);
}

export async function sletKlippekort(id: string) {
  // Kun Administrator og Superadministrator kan slette
  await kraevAdmin();
  // Tidsposterne slippes fri i stedet for at forsvinde — timerne er stadig brugt.
  const kort = await db.$transaction(async (tx) => {
    await tx.timeLog.updateMany({ where: { bundleId: id }, data: { bundleId: null } });
    return tx.hourBundle.delete({ where: { id } });
  });
  opfrisk(kort.companyId);
}

// ============================================================
// TID
// ============================================================

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Genberegner et klippekorts forbrug ud fra de tidsposter der peger på det. */
async function opdaterForbrug(tx: Tx, bundleId: string | null | undefined) {
  if (!bundleId) return;
  const sum = await tx.timeLog.aggregate({ where: { bundleId }, _sum: { durationMin: true } });
  await tx.hourBundle.update({ where: { id: bundleId }, data: { usedMinutes: sum._sum.durationMin ?? 0 } });
}

export async function registrerTid(formData: FormData) {
  await kraevTid();
  const f = formular(formData);
  const companyId = f.tekst("companyId");
  const minutter = f.heltal("durationMin");
  if (!companyId || minutter == null || minutter <= 0 || minutter > 24 * 60) return;

  // Kort og sag skal høre til samme kunde som tiden
  const [kort, sag] = await Promise.all([
    f.tekst("bundleId") ? db.hourBundle.findFirst({ where: { id: f.tekst("bundleId")!, companyId }, select: { id: true } }) : null,
    f.tekst("ticketId") ? db.ticket.findFirst({ where: { id: f.tekst("ticketId")!, companyId }, select: { id: true } }) : null,
  ]);

  await db.$transaction(async (tx) => {
    await tx.timeLog.create({
      data: {
        companyId,
        ticketId: sag?.id ?? null,
        bundleId: kort?.id ?? null,
        date: f.dato("date") ?? new Date(),
        durationMin: minutter,
        description: f.tekst("description"),
        isBillable: formData.get("isBillable") !== "off",
      },
    });
    await opdaterForbrug(tx, kort?.id);
  });
  opfrisk(companyId, sag?.id);
}

export async function sletTid(id: string) {
  // Kun Administrator og Superadministrator kan slette
  await kraevAdmin();
  const post = await db.$transaction(async (tx) => {
    const p = await tx.timeLog.delete({ where: { id } });
    await opdaterForbrug(tx, p.bundleId);
    return p;
  });
  opfrisk(post.companyId, post.ticketId);
}

// ============================================================
// LOGBOG
// ============================================================

export async function skrivLog(kundeId: string, formData: FormData) {
  const mig = await kraevLogbog();
  const f = formular(formData);
  const content = f.tekst("content");
  if (!content) return;
  await db.logEntry.create({
    data: { companyId: kundeId, kind: f.valg("kind", LOGTYPER, "note"), content, author: mig.initials },
  });
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/dashboard");
}

export async function skiftFastgjort(id: string, kundeId: string, fastgjort: boolean) {
  await kraevLogbog();
  await db.logEntry.updateMany({ where: { id, companyId: kundeId }, data: { pinned: fastgjort } });
  revalidatePath(`/kunder/${kundeId}`);
}

export async function sletLog(id: string, kundeId: string) {
  // Logbogen er kundens historik — kun Superadministrator kan slette i den
  await kraevSuperAdmin();
  await db.logEntry.deleteMany({ where: { id, companyId: kundeId } });
  revalidatePath(`/kunder/${kundeId}`);
}
