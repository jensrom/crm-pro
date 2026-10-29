"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { kraevSuperAdmin } from "@/lib/auth";
import { bygDemomiljoe } from "@/lib/demomiljoe";

/**
 * Demodata.
 *
 * Demomiljøet (lib/demomiljoe.ts) bygges fra Indstillinger → Demomiljø.
 * Den ældre demofunktion lagde poster med id-præfikset "demo_" ud over de
 * eksisterende kunder — de kan stadig fjernes herfra, hvis de findes.
 */

const PRAEFIKS = "demo_";

export async function fjernDemodata() {
  await kraevSuperAdmin();
  await fjernAlt();
  opfrisk();
  redirect("/indstillinger?demo=fjernet");
}

async function fjernAlt() {
  const hvor = { id: { startsWith: PRAEFIKS } };
  // Er der registreret tid fra et rigtigt klippekort på en demosag, forsvinder
  // tidsposten med sagen — så kortets forbrug skal regnes forfra bagefter.
  const kort = await db.timeLog.findMany({
    where: { ticketId: { startsWith: PRAEFIKS }, bundleId: { not: null } },
    select: { bundleId: true },
    distinct: ["bundleId"],
  });
  await db.$transaction([
    db.logEntry.deleteMany({ where: hvor }),
    db.customerNote.deleteMany({ where: hvor }),
    db.ticket.deleteMany({ where: hvor }),
    db.deal.deleteMany({ where: hvor }),
  ]);
  for (const { bundleId } of kort) {
    if (!bundleId) continue;
    const sum = await db.timeLog.aggregate({ where: { bundleId }, _sum: { durationMin: true } });
    await db.hourBundle.update({ where: { id: bundleId }, data: { usedMinutes: sum._sum.durationMin ?? 0 } });
  }
}

/** Antal demoposter der ligger i databasen lige nu. */
export async function taelDemodata() {
  await kraevSuperAdmin();
  const hvor = { id: { startsWith: PRAEFIKS } };
  const [d, t, n] = await Promise.all([
    db.deal.count({ where: hvor }),
    db.ticket.count({ where: hvor }),
    db.customerNote.count({ where: hvor }),
  ]);
  return d + t + n;
}

function opfrisk() {
  revalidatePath("/", "layout");
}

/**
 * Sletter alle kunder og bygger demomiljøet op fra bunden (lib/demomiljoe.ts).
 * Kræver at brugeren har sat flueben ved, at backuppen er hentet.
 */
export async function bygDemomiljoeHandling(formData: FormData) {
  const mig = await kraevSuperAdmin();
  if (formData.get("backup") !== "1") redirect("/indstillinger?demo=backup#demomiljoe");
  const r = await bygDemomiljoe(mig.initials);
  opfrisk();
  redirect(`/indstillinger?demo=bygget&antal=${r.kunder}&produkter=${r.produkter}&licenser=${r.licenser}#demomiljoe`);
}
