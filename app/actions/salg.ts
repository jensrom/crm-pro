"use server";

/**
 * Salg: salgsmuligheder (leads og opportunities), aktiviteter og pipeline-indstillingen.
 * Hver bevægelse på en salgsmulighed skrives i kundens logbog.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { kraevLeads, kraevSkriv, kraevSuperAdmin } from "@/lib/auth";
import { formular, type Formular } from "@/lib/formular";
import { AKTIVITETSTYPER, STADIER } from "@/lib/labels";
import { STADIE_SANDSYNLIGHED, afsluttetDage, erAfsluttet, stadieLabel } from "@/lib/pipeline";

/** Skriver en linje i kundens logbog, så bevægelser på salgssiden kan følges. */
async function logSalg(companyId: string, tekst: string, initialer: string | null) {
  await db.logEntry.create({ data: { companyId, kind: "salg", content: tekst, author: initialer } });
}

function opfriskSalg(companyId: string) {
  revalidatePath("/leads");
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
  revalidatePath(`/kunder/${companyId}`);
}

const procent = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Felterne der er ens for oprettelse og redigering. */
function sagsfelter(f: Formular) {
  return {
    productId: f.tekst("productId"),
    seatDelta: f.heltal("seatDelta"),
    value: f.tal("value"),
    expectedCloseDate: f.dato("expectedCloseDate"),
    nextStep: f.tekst("nextStep"),
    notes: f.tekst("notes"),
  };
}

export async function opretSag(formData: FormData) {
  const f = formular(formData);
  const stage = f.valg("stage", STADIER, "ny");
  // Et lead må en Sælger selv oprette; alt længere fremme kræver skriveadgang til salg.
  const mig = stage === "ny" ? await kraevLeads() : await kraevSkriv("salg");
  const companyId = f.tekst("companyId");
  const title = f.tekst("title");
  if (!companyId || !title) return;

  const nu = new Date();
  await db.deal.create({
    data: {
      companyId,
      title,
      ...sagsfelter(f),
      stage,
      probability: procent(f.tal("probability") ?? STADIE_SANDSYNLIGHED[stage] ?? 10),
      stageChangedAt: nu,
      closedAt: erAfsluttet(stage) ? nu : null,
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
  const d = await db.deal.update({
    where: { id },
    data: {
      stage: stadie,
      stageChangedAt: new Date(),
      closedAt: afsluttet ? new Date() : null,
      probability: afsluttet || uroert ? STADIE_SANDSYNLIGHED[stadie] : undefined,
    },
  });
  await logSalg(d.companyId, `${d.title}: ${stadieLabel(foer.stage)} → ${stadieLabel(stadie)}`, mig.initials);
  opfriskSalg(d.companyId);
}

export async function opdaterSag(id: string, formData: FormData) {
  await kraevSkriv("salg");
  const f = formular(formData);
  const title = f.tekst("title");
  if (!title) return;
  const sandsynlighed = f.tal("probability");
  const d = await db.deal.update({
    where: { id },
    data: { title, ...sagsfelter(f), probability: sandsynlighed == null ? undefined : procent(sandsynlighed) },
  });
  opfriskSalg(d.companyId);
}

export async function sletSag(id: string) {
  const mig = await kraevSkriv("salg");
  const d = await db.deal.delete({ where: { id } });
  await logSalg(d.companyId, `Salgsmulighed slettet: ${d.title}`, mig.initials);
  opfriskSalg(d.companyId);
}

function opfriskAktiviteter(companyId?: string | null) {
  revalidatePath("/aktiviteter");
  revalidatePath("/dashboard");
  if (companyId) revalidatePath(`/kunder/${companyId}`);
}

export async function opretAktivitet(formData: FormData) {
  await kraevSkriv("salg");
  const f = formular(formData);
  const subject = f.tekst("subject");
  if (!subject) return;
  const companyId = f.tekst("companyId");
  await db.activity.create({
    data: {
      type: f.valg("type", AKTIVITETSTYPER, "note"),
      subject,
      description: f.tekst("description"),
      dueDate: f.dato("dueDate"),
      companyId,
      contactId: f.tekst("contactId"),
      dealId: f.tekst("dealId"),
    },
  });
  opfriskAktiviteter(companyId);
}

export async function skiftAktivitet(id: string, faerdig: boolean) {
  await kraevSkriv("salg");
  const a = await db.activity.update({ where: { id }, data: { completedAt: faerdig ? new Date() : null } });
  opfriskAktiviteter(a.companyId);
}

export async function sletAktivitet(id: string) {
  await kraevSkriv("salg");
  const a = await db.activity.delete({ where: { id } });
  opfriskAktiviteter(a.companyId);
}

export async function gemPipelineIndstilling(formData: FormData) {
  await kraevSuperAdmin();
  const v = formular(formData).tal("pipelineDoneDays");
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
