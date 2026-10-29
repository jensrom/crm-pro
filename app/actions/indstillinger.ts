"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kraevSuperAdmin } from "@/lib/auth";
import { gyldigBaggrund, gyldigStyrke } from "@/lib/baggrunde";
import { tekst } from "@/lib/formular";


/** Et logo skal kunne ligge i databasen uden at gøre den tung. */
const MAKS_LOGO_BYTES = 400_000;
const TILLADTE = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"];

function opfrisk() {
  revalidatePath("/", "layout");
  revalidatePath("/indstillinger/whitelabel");
}

export async function gemWhitelabel(formData: FormData) {
  await kraevSuperAdmin();
  const data: {
    brandSubtitle: string | null;
    brandMarkText: string | null;
    brandLogo?: string | null;
  } = {
    brandSubtitle: tekst(formData.get("brandSubtitle")),
    brandMarkText: tekst(formData.get("brandMarkText"))?.slice(0, 3) ?? null,
  };

  if (formData.get("fjernLogo") === "on") {
    data.brandLogo = null;
  } else {
    const fil = formData.get("logo");
    if (fil instanceof File && fil.size > 0) {
      if (!TILLADTE.includes(fil.type)) {
        redirect("/indstillinger/whitelabel?fejl=filtype");
      }
      if (fil.size > MAKS_LOGO_BYTES) {
        redirect("/indstillinger/whitelabel?fejl=stoerrelse");
      }
      const base64 = Buffer.from(await fil.arrayBuffer()).toString("base64");
      data.brandLogo = `data:${fil.type};base64,${base64}`;
    }
  }

  await db.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  opfrisk();
  redirect("/indstillinger/whitelabel?besked=gemt");
}

/** Baggrundsbilledet: stort nok til en skærm, småt nok til at gå gennem en server-handling (4,5 MB). */
const MAKS_BAGGRUND_BYTES = 3_000_000;
const BAGGRUND_TYPER = ["image/jpeg", "image/png", "image/webp"];

/** Indstillinger → Udseende: appens svage baggrund under glasset. */
export async function gemUdseende(formData: FormData) {
  await kraevSuperAdmin();
  const moenster = gyldigBaggrund(tekst(formData.get("bgPattern")));
  const data: { bgPattern: string; bgStrength: number; bgMobile: boolean; bgImage?: string | null } = {
    bgPattern: moenster,
    bgStrength: gyldigStyrke(Number(formData.get("bgStrength"))),
    bgMobile: formData.get("bgMobile") === "on",
  };

  if (formData.get("fjernBillede") === "on") data.bgImage = null;
  const fil = formData.get("bgFil");
  if (fil instanceof File && fil.size > 0) {
    if (!BAGGRUND_TYPER.includes(fil.type)) redirect("/indstillinger/udseende?fejl=filtype");
    if (fil.size > MAKS_BAGGRUND_BYTES) redirect("/indstillinger/udseende?fejl=stoerrelse");
    data.bgImage = `data:${fil.type};base64,${Buffer.from(await fil.arrayBuffer()).toString("base64")}`;
    data.bgPattern = "billede";
  }
  // "Eget billede" uden et billede giver ingen mening — så falder vi tilbage til standard.
  if (data.bgPattern === "billede") {
    const har = data.bgImage ?? (await db.settings.findUnique({ where: { id: "singleton" }, select: { bgImage: true } }))?.bgImage;
    if (!har) data.bgPattern = "aurora";
  }

  await db.settings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  revalidatePath("/", "layout");
  redirect("/indstillinger/udseende?besked=gemt");
}

export async function gemDatagrundlag(formData: FormData) {
  await kraevSuperAdmin();
  const note = tekst(formData.get("dataSourceNote"));
  await db.settings.upsert({
    where: { id: "singleton" },
    update: { dataSourceNote: note },
    create: { id: "singleton", dataSourceNote: note },
  });
  revalidatePath("/dashboard");
  revalidatePath("/indstillinger/whitelabel");
  redirect("/indstillinger/whitelabel?besked=note");
}

/** Afsenderoplysninger og standardtekster til licensbevis og ordrebekræftelse. */
export async function gemDokumentindstillinger(formData: FormData) {
  await kraevSuperAdmin();
  const moms = tekst(formData.get("docVatRate"));
  const n = moms == null ? null : Number(moms.replace(",", "."));
  await db.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {
      docCompanyName: tekst(formData.get("docCompanyName")),
      docDepartment: tekst(formData.get("docDepartment")),
      docCvr: tekst(formData.get("docCvr")),
      docAddress: tekst(formData.get("docAddress")),
      docZipCity: tekst(formData.get("docZipCity")),
      docCountry: tekst(formData.get("docCountry")),
      docEmail: tekst(formData.get("docEmail")),
      docPhone: tekst(formData.get("docPhone")),
      docWebsite: tekst(formData.get("docWebsite")),
      docBankInfo: tekst(formData.get("docBankInfo")),
      docPaymentTerms: tekst(formData.get("docPaymentTerms")),
      ...(formData.has("docVatRate") ? { docVatRate: n != null && Number.isFinite(n) ? n : null } : {}),
      docCertText: tekst(formData.get("docCertText")),
      docOrderText: tekst(formData.get("docOrderText")),
    },
  });
  revalidatePath("/indstillinger/dokumenter");
  redirect("/indstillinger/dokumenter?besked=gemt");
}

// ============================================================
// AFSENDERPROFILER (afdelinger, fx Aarhus og Odense)
// ============================================================

const DOK = "/indstillinger/dokumenter";

function profilData(formData: FormData) {
  return {
    department: tekst(formData.get("department")),
    companyName: tekst(formData.get("companyName")),
    cvr: tekst(formData.get("cvr")),
    address: tekst(formData.get("address")),
    zipCity: tekst(formData.get("zipCity")),
    country: tekst(formData.get("country")),
    email: tekst(formData.get("email")),
    phone: tekst(formData.get("phone")),
    website: tekst(formData.get("website")),
    bankInfo: tekst(formData.get("bankInfo")),
  };
}

export async function opretAfsenderprofil(formData: FormData) {
  const mig = await kraevSuperAdmin();
  const name = tekst(formData.get("name"));
  if (!name) redirect(`${DOK}?fejl=profil-navn`);
  const isDefault = formData.get("isDefault") === "on" || (await db.senderProfile.count()) === 0;
  const sidste = await db.senderProfile.findFirst({ orderBy: { sortOrder: "desc" } });
  await db.$transaction(async (tx) => {
    if (isDefault) await tx.senderProfile.updateMany({ data: { isDefault: false } });
    await tx.senderProfile.create({
      data: { name, ...profilData(formData), isDefault, sortOrder: (sidste?.sortOrder ?? 0) + 1, updatedBy: mig.initials },
    });
  });
  revalidatePath(DOK);
  revalidatePath("/indstillinger/brugere");
  redirect(`${DOK}?besked=profil-oprettet#profiler`);
}

export async function gemAfsenderprofil(id: string, formData: FormData) {
  const mig = await kraevSuperAdmin();
  const name = tekst(formData.get("name"));
  if (!name) redirect(`${DOK}?fejl=profil-navn#profiler`);
  const isDefault = formData.get("isDefault") === "on";
  await db.$transaction(async (tx) => {
    if (isDefault) await tx.senderProfile.updateMany({ where: { NOT: { id } }, data: { isDefault: false } });
    await tx.senderProfile.update({
      where: { id },
      data: { name, ...profilData(formData), isDefault, isActive: formData.get("isActive") === "on", updatedBy: mig.initials },
    });
  });
  revalidatePath(DOK);
  revalidatePath("/indstillinger/brugere");
  redirect(`${DOK}?besked=profil-gemt#profiler`);
}

/** Sletter profilen. Brugere og dokumenter der pegede på den, falder tilbage til standardprofilen. */
export async function sletAfsenderprofil(id: string) {
  await kraevSuperAdmin();
  await db.senderProfile.delete({ where: { id } });
  revalidatePath(DOK);
  revalidatePath("/indstillinger/brugere");
  redirect(`${DOK}?besked=profil-slettet#profiler`);
}
