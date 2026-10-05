"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAKS_FILSTOERRELSE, saniterFilnavn } from "@/lib/filer";
import { normaliserKategori } from "@/lib/attachment-categories";
import { kraevBruger } from "@/lib/auth";

/** Alle filer på en kunde, nyeste først — uden selve indholdet. */
export async function hentFiler(companyId: string) {
  await kraevBruger();
  return db.attachment.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, companyId: true, filename: true, category: true, mimeType: true, sizeBytes: true, createdAt: true, uploadedBy: true },
  });
}

/** Modtager en fil via et almindeligt <form action={...}> og gemmer den i databasen. */
export async function uploadFil(companyId: string, formData: FormData) {
  const mig = await kraevBruger();
  const kunde = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!kunde) throw new Error("Kunde ikke fundet");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAKS_FILSTOERRELSE) redirect(`/kunder/${companyId}?fil=for-stor#filer`);

  const bytes = Buffer.from(await file.arrayBuffer());
  await db.attachment.create({
    data: {
      companyId,
      filename: saniterFilnavn(file.name || "fil"),
      category: normaliserKategori(formData.get("category")),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: bytes.byteLength,
      data: bytes,
      uploadedBy: mig.initials,
    },
    select: { id: true },
  });

  revalidatePath(`/kunder/${companyId}`);
}

/** Flytter en fil til en anden kategori — fx når en mail hører til som kontrakt. */
export async function flytFilKategori(id: string, formData: FormData) {
  await kraevBruger();
  const category = normaliserKategori(formData.get("category"));
  const att = await db.attachment.update({ where: { id }, data: { category }, select: { companyId: true } });
  revalidatePath(`/kunder/${att.companyId}`);
}

export async function sletFil(id: string) {
  await kraevBruger();
  const att = await db.attachment.delete({ where: { id }, select: { companyId: true } }).catch(() => null);
  if (att) revalidatePath(`/kunder/${att.companyId}`);
}
