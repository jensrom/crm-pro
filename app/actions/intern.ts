"use server";

/**
 * Intern salg: en godkendt ordre sendes til intern salg, som bestiller hos
 * leverandøren og følger den til den er leveret (se lib/intern.ts).
 * Hvert skridt skrives i kundens logbog.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { kraevIntern, kraevSkriv, kraevAdmin } from "@/lib/auth";
import { formular } from "@/lib/formular";
import { dokNr } from "@/lib/dokumenter";
import { INTERN_STATUS, erInternStatus, findInternStatus } from "@/lib/intern";

function opfrisk(orderId: string, companyId?: string | null) {
  revalidatePath("/intern");
  revalidatePath("/ordrer");
  revalidatePath(`/ordrer/${orderId}`);
  revalidatePath("/dashboard");
  if (companyId) revalidatePath(`/kunder/${companyId}`);
}

async function log(companyId: string | null, tekst: string, initialer: string | null) {
  if (!companyId) return;
  await db.logEntry.create({ data: { companyId, kind: "aftale", content: tekst, author: initialer } });
}

/** Sælgeren sender en ordrebekræftelse videre til intern salg. */
export async function sendTilIntern(orderId: string) {
  const mig = await kraevSkriv("salg");
  const o = await db.order.findUnique({ where: { id: orderId }, select: { id: true, kind: true, number: true, companyId: true, internStatus: true } });
  if (!o || o.kind !== "ordre" || o.internStatus) redirect(`/ordrer/${orderId}`);
  await db.order.update({
    where: { id: o.id },
    data: { internStatus: "pending", internSentAt: new Date(), internSentBy: mig.initials },
  });
  await log(o.companyId, `${dokNr(o)} sendt til intern salg`, mig.initials);
  opfrisk(o.id, o.companyId);
  redirect(`/ordrer/${o.id}?besked=intern`);
}

/**
 * Flytter ordren til et andet trin. Trinnets tidspunkt sættes til nu; går man
 * et trin tilbage, ryddes tidspunkterne for de senere trin.
 */
export async function skiftInternStatus(orderId: string, status: string) {
  const mig = await kraevIntern();
  if (!erInternStatus(status)) return;
  const o = await db.order.findUnique({ where: { id: orderId }, select: { id: true, kind: true, number: true, companyId: true, internStatus: true, internAnsvarlig: true } });
  if (!o || !o.internStatus || o.internStatus === status) return;

  const ny = INTERN_STATUS.findIndex((s) => s.key === status);
  const tider: Record<string, Date | null> = {};
  INTERN_STATUS.forEach((s, i) => {
    if (s.key === "pending") return; // afsendelsestidspunktet bevares altid
    if (i === ny) tider[s.tidsfelt] = new Date();
    else if (i > ny) tider[s.tidsfelt] = null;
  });

  await db.order.update({
    where: { id: o.id },
    data: { internStatus: status, internAnsvarlig: o.internAnsvarlig ?? mig.initials, ...tider },
  });
  await log(o.companyId, `${dokNr(o)}: ${findInternStatus(o.internStatus)?.label} → ${findInternStatus(status)?.label}`, mig.initials);
  opfrisk(o.id, o.companyId);
}

/** Leverandørens ordrenummer, intern note og licensdata pr. linje. */
export async function gemInternData(orderId: string, formData: FormData) {
  await kraevIntern();
  const f = formular(formData);
  const o = await db.order.findUnique({ where: { id: orderId }, select: { id: true, companyId: true, lines: { select: { id: true } } } });
  if (!o) return;
  await db.$transaction([
    db.order.update({
      where: { id: o.id },
      data: { leverandoerOrdrenr: f.tekst("leverandoerOrdrenr"), internNote: f.tekst("internNote"), internAnsvarlig: f.tekst("internAnsvarlig")?.toUpperCase() ?? undefined },
    }),
    ...o.lines.map((l) =>
      db.orderLine.update({
        where: { id: l.id },
        data: {
          leverandoerRef: f.tekst(`ref_${l.id}`),
          placering: f.tekst(`placering_${l.id}`),
          partNr: f.tekst(`part_${l.id}`),
          version: f.tekst(`version_${l.id}`),
        },
      })
    ),
  ]);
  opfrisk(o.id, o.companyId);
  redirect(`/ordrer/${o.id}?besked=intern-gemt#intern`);
}

/** Tager ordren ud af intern salg igen (fx sendt ved en fejl). */
export async function fjernFraIntern(orderId: string) {
  // Kun Administrator og Superadministrator kan slette
  const mig = await kraevAdmin();
  const o = await db.order.findUnique({ where: { id: orderId }, select: { id: true, kind: true, number: true, companyId: true } });
  if (!o) return;
  await db.order.update({
    where: { id: o.id },
    data: {
      internStatus: null, internSentAt: null, internSentBy: null, internAnsvarlig: null,
      internBestiltAt: null, internAfventerAt: null, internKlarAt: null, internAfsluttetAt: null,
    },
  });
  await log(o.companyId, `${dokNr(o)} taget ud af intern salg`, mig.initials);
  opfrisk(o.id, o.companyId);
}
