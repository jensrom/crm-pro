"use server";

/**
 * Kundens logbog: korte referater af hvad der er sagt, aftalt eller bemærket.
 */
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { kraevLogbog, kraevSuperAdmin } from "@/lib/auth";
import { formular } from "@/lib/formular";
import { LOGTYPER } from "@/lib/labels";

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
