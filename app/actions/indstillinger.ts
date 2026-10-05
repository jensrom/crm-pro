"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kraevSuperAdmin } from "@/lib/auth";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

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
    brandSubtitle: txt(formData.get("brandSubtitle")),
    brandMarkText: txt(formData.get("brandMarkText"))?.slice(0, 3) ?? null,
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

export async function gemDatagrundlag(formData: FormData) {
  await kraevSuperAdmin();
  const note = txt(formData.get("dataSourceNote"));
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
  const moms = txt(formData.get("docVatRate"));
  const n = moms == null ? null : Number(moms.replace(",", "."));
  await db.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {
      docCompanyName: txt(formData.get("docCompanyName")),
      docDepartment: txt(formData.get("docDepartment")),
      docCvr: txt(formData.get("docCvr")),
      docAddress: txt(formData.get("docAddress")),
      docZipCity: txt(formData.get("docZipCity")),
      docCountry: txt(formData.get("docCountry")),
      docEmail: txt(formData.get("docEmail")),
      docPhone: txt(formData.get("docPhone")),
      docWebsite: txt(formData.get("docWebsite")),
      docBankInfo: txt(formData.get("docBankInfo")),
      docPaymentTerms: txt(formData.get("docPaymentTerms")),
      ...(formData.has("docVatRate") ? { docVatRate: n != null && Number.isFinite(n) ? n : null } : {}),
      docCertText: txt(formData.get("docCertText")),
      docOrderText: txt(formData.get("docOrderText")),
    },
  });
  revalidatePath("/indstillinger/dokumenter");
  redirect("/indstillinger/dokumenter?besked=gemt");
}

// ============================================================
// AFSENDERPROFILER (afdelinger, fx Horsens og Glostrup)
// ============================================================

const DOK = "/indstillinger/dokumenter";

function profilData(formData: FormData) {
  return {
    department: txt(formData.get("department")),
    companyName: txt(formData.get("companyName")),
    cvr: txt(formData.get("cvr")),
    address: txt(formData.get("address")),
    zipCity: txt(formData.get("zipCity")),
    country: txt(formData.get("country")),
    email: txt(formData.get("email")),
    phone: txt(formData.get("phone")),
    website: txt(formData.get("website")),
    bankInfo: txt(formData.get("bankInfo")),
  };
}

export async function opretAfsenderprofil(formData: FormData) {
  const mig = await kraevSuperAdmin();
  const name = txt(formData.get("name"));
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
  const name = txt(formData.get("name"));
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
