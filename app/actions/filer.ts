"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { gemFilPaaDisk, sletFilFraDisk } from "@/lib/filer";
import { normaliserKategori } from "@/lib/attachment-categories";
import { laesSessionKiks } from "@/lib/sessionkiks";

// Prisma-klienten er ikke regenereret i denne sandbox endnu (netvaerket kan
// ikke naa binaries.prisma.sh, se PORTABEL.md-fejlsoegning) -- saa
// Attachment-modellen mangler stadig i de genererede typer. `attDb` er kun
// et typemidlertidigt kig forbi det, indtil `node scripts/prisma.mjs
// generate` er koert paa en maskine med normal netadgang.
const attDb = db as any;

/** Alle uploadede filer paa en kunde, nyeste foerst. */
export async function hentFiler(companyId: string) {
  return attDb.attachment.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Modtager en fil via et almindeligt <form action={...}> (ingen klient-JS
 * noedvendig -- ligesom resten af CRM-Pro). Filen skrives til disk, og kun
 * stien gemmes i databasen.
 */
export async function uploadFil(companyId: string, formData: FormData) {
  const kunde = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!kunde) throw new Error("Kunde ikke fundet");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const category = normaliserKategori(formData.get("category"));
  const { storedPath, filename, mimeType, sizeBytes } = await gemFilPaaDisk(companyId, file);

  const kiks = await laesSessionKiks();
  await attDb.attachment.create({
    data: {
      companyId,
      filename,
      category,
      mimeType,
      sizeBytes,
      storedPath,
      uploadedBy: kiks?.initials ?? null,
    },
  });

  revalidatePath(`/kunder/${companyId}`);
}

/** Flytter en fil til en anden kategori -- fx naar en mail hoerer til som kontrakt. */
export async function flytFilKategori(id: string, formData: FormData) {
  const category = normaliserKategori(formData.get("category"));
  const att = await attDb.attachment.update({ where: { id }, data: { category } });
  revalidatePath(`/kunder/${att.companyId}`);
}

export async function sletFil(id: string) {
  const att = await attDb.attachment.findUnique({ where: { id } });
  if (!att) return;
  await attDb.attachment.delete({ where: { id } });
  await sletFilFraDisk(att.storedPath);
  revalidatePath(`/kunder/${att.companyId}`);
}
