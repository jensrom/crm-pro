"use server";

import { copyFileSync, existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { revalidatePath } from "next/cache";
import { antalBrugere, kraevSuperAdmin } from "@/lib/auth";
import { databaseSti, dataMappe, gemDatabaseSti, tjekSti } from "@/lib/config";
import { db } from "@/lib/db";
import { findBackup, gendan, lavBackup, sletBackup as fjernFil } from "@/lib/backup";
import { redirect } from "next/navigation";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * Skifter hvor databasefilen ligger.
 *
 * Findes der ikke en fil på den nye sti, kan den nuværende database kopieres
 * med — ellers starter du på en tom base. Skiftet træder først i kraft når
 * programmet genstartes, fordi datakilden læses ved opstart.
 */
export async function gemDatabaseplacering(formData: FormData) {
  await kraevSuperAdmin();

  const nySti = txt(formData.get("databasePath"));
  if (!nySti) redirect("/indstillinger/database?fejl=tom");

  const abs = isAbsolute(nySti) ? nySti : resolve(dataMappe(), nySti);
  if (abs === databaseSti()) redirect("/indstillinger/database?besked=uaendret");

  const tjek = tjekSti(nySti);
  if (!tjek.ok) redirect(`/indstillinger/database?fejl=sti&grund=${encodeURIComponent(tjek.grund ?? "")}`);

  const kopier = formData.get("kopier") === "on";
  if (kopier && !existsSync(abs)) {
    const nuvaerende = databaseSti();
    if (existsSync(nuvaerende)) {
      try {
        copyFileSync(nuvaerende, abs);
      } catch {
        redirect("/indstillinger/database?fejl=kopi");
      }
    }
  }

  gemDatabaseSti(nySti);
  redirect("/indstillinger/database?besked=gemt");
}


// ============================================================
// SIKKERHEDSKOPIER
// ============================================================

/** Tager en kopi af databasen som den ser ud lige nu. */
export async function tagBackup() {
  const mig = await kraevSuperAdmin();

  let filnavn: string;
  try {
    filnavn = (await lavBackup(db, mig.initials)).filnavn;
  } catch (e: any) {
    redirect(`/indstillinger/database?fejl=backup&grund=${encodeURIComponent(e?.message ?? "")}`);
  }

  revalidatePath("/indstillinger/database");
  redirect(`/indstillinger/database?besked=backup&fil=${encodeURIComponent(filnavn)}`);
}

/**
 * Lægger en kopi tilbage.
 *
 * Inden den nuværende database overskrives, tages der automatisk en kopi af
 * den. Fortryder man gendannelsen, ligger det man kom fra altså stadig i
 * listen — mærket "før gendannelse".
 */
export async function gendanBackup(formData: FormData) {
  const mig = await kraevSuperAdmin();

  const valgt = txt(formData.get("filnavn"));
  if (!valgt) redirect("/indstillinger/database?fejl=vaelg");

  const b = findBackup(valgt);
  if (!b) redirect("/indstillinger/database?fejl=findes_ikke");

  if (formData.get("bekraeft") !== "on") {
    redirect("/indstillinger/database?fejl=bekraeft");
  }

  try {
    // 1. Red det nuværende, så gendannelsen selv kan fortrydes.
    await lavBackup(db, mig.initials, "foer-gendannelse");
    // 2. Slip filen, så den kan skiftes ud under os.
    await db.$disconnect();
    // 3. Læg kopien tilbage.
    gendan(b.sti);
  } catch (e: any) {
    redirect(`/indstillinger/database?fejl=gendan&grund=${encodeURIComponent(e?.message ?? "")}`);
  }

  revalidatePath("/", "layout");
  redirect(`/indstillinger/database?besked=gendannet&fil=${encodeURIComponent(b.filnavn)}`);
}

export async function sletBackup(formData: FormData) {
  await kraevSuperAdmin();
  const valgt = txt(formData.get("filnavn"));
  if (!valgt) redirect("/indstillinger/database?fejl=vaelg");
  const b = findBackup(valgt);
  if (b) fjernFil(b.sti);
  revalidatePath("/indstillinger/database");
  redirect("/indstillinger/database?besked=slettet");
}


/**
 * Peger en frisk installation på en database der allerede findes.
 *
 * Den her vej findes fordi der ellers er en knude: for at komme ind i
 * Indstillinger skal man logge ind, og for at kunne logge ind skal man være i
 * den rigtige database. Derfor må stien sættes ét sted uden login — på
 * førstegangsskærmen, og kun så længe der overhovedet ikke findes en bruger.
 * I samme øjeblik der er én, er døren lukket.
 */
export async function pegPaaEksisterendeDatabase(formData: FormData) {
  if ((await antalBrugere()) > 0) redirect("/login");

  const nySti = txt(formData.get("databasePath"));
  if (!nySti) redirect("/opsaetning?fejl=tom_sti");

  const abs = isAbsolute(nySti) ? nySti : resolve(dataMappe(), nySti);
  if (!existsSync(abs)) redirect("/opsaetning?fejl=findes_ikke");

  gemDatabaseSti(nySti);
  redirect("/opsaetning?besked=peget");
}
