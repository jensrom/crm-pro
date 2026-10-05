"use server";

import { db } from "@/lib/db";
import { kraevAdmin, kraevBruger } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ANTAL_FRIE_LINJER, fraIsoDato, ordreNr } from "@/lib/dokumenter";
import { ordrePdf } from "@/lib/ordre-pdf";
import { gemDokumentIFilboks } from "@/lib/filer";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  if (s == null) return null;
  const n = Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const heltal = (v: FormDataEntryValue | null) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

/**
 * Opretter en ordrebekræftelse.
 *
 * Licenslinjer: flueben "vaelg" = productId, med antal_<id>, pris_<id>, mdr_<id>.
 * Frie linjer:  fri_tekst_<n>, fri_antal_<n>, fri_pris_<n>, fri_mdr_<n>.
 * Har ordren en kunde, gemmes PDF'en også i kundens filboks og noteres i logbogen.
 */
export async function opretOrdre(formData: FormData) {
  const mig = await kraevBruger();
  const companyId = txt(formData.get("companyId"));
  const tilbage = `/ordrer/ny${companyId ? `?kunde=${companyId}` : ""}`;

  const kunde = companyId ? await db.company.findUnique({ where: { id: companyId } }) : null;
  const recipientName = txt(formData.get("recipientName")) ?? kunde?.name ?? null;
  if (!recipientName) redirect(`${tilbage}${companyId ? "&" : "?"}fejl=modtager`);

  const valgte = formData.getAll("vaelg").filter((v): v is string => typeof v === "string" && v !== "");
  const produkter = valgte.length
    ? await db.product.findMany({ where: { id: { in: valgte } }, include: { family: true } })
    : [];
  // Bevar katalogets rækkefølge
  produkter.sort(
    (a, b) => (a.family?.sortOrder ?? 999) - (b.family?.sortOrder ?? 999) || a.sortOrder - b.sortOrder
  );

  const linjer: {
    productId: string | null; description: string; quantity: number; unitPrice: number | null;
    months: number | null; licenseModel: string; sortOrder: number;
  }[] = [];

  for (const p of produkter) {
    const perpetual = p.licenseModel === "perpetual";
    linjer.push({
      productId: p.id,
      description: p.family ? `${p.family.name} · ${p.name}` : p.name,
      quantity: Math.max(1, heltal(formData.get(`antal_${p.id}`)) ?? 1),
      unitPrice: num(formData.get(`pris_${p.id}`)),
      months: perpetual ? null : Math.max(1, heltal(formData.get(`mdr_${p.id}`)) ?? 12),
      licenseModel: p.licenseModel,
      sortOrder: linjer.length,
    });
  }
  for (let i = 0; i < ANTAL_FRIE_LINJER; i++) {
    const tekst = txt(formData.get(`fri_tekst_${i}`));
    if (!tekst) continue;
    const mdr = heltal(formData.get(`fri_mdr_${i}`));
    linjer.push({
      productId: null,
      description: tekst,
      quantity: Math.max(1, heltal(formData.get(`fri_antal_${i}`)) ?? 1),
      unitPrice: num(formData.get(`fri_pris_${i}`)),
      months: mdr && mdr > 0 ? mdr : null,
      licenseModel: mdr && mdr > 0 ? "sub" : "perpetual",
      sortOrder: linjer.length,
    });
  }
  if (linjer.length === 0) redirect(`${tilbage}${companyId ? "&" : "?"}fejl=linjer`);

  const sidste = await db.order.aggregate({ _max: { number: true } });
  const ordre = await db.order.create({
    data: {
      number: (sidste._max.number ?? 0) + 1,
      companyId: kunde?.id ?? null,
      recipientName,
      recipientAttn: txt(formData.get("recipientAttn")),
      recipientAddress: txt(formData.get("recipientAddress")),
      recipientEmail: txt(formData.get("recipientEmail")),
      reference: txt(formData.get("reference")),
      orderDate: fraIsoDato(txt(formData.get("orderDate"))) ?? new Date(),
      note: txt(formData.get("note")),
      vatRate: num(formData.get("vatRate")) ?? 25,
      createdBy: mig.initials,
      lines: { create: linjer },
    },
  });

  if (kunde) {
    const pdf = await ordrePdf(ordre.id);
    if (pdf) {
      const attId = await gemDokumentIFilboks(kunde.id, pdf.navn, pdf.bytes, "ordre", mig.initials);
      await db.order.update({ where: { id: ordre.id }, data: { attachmentId: attId } });
    }
    await db.logEntry.create({
      data: {
        companyId: kunde.id,
        kind: "aftale",
        content: `Ordrebekræftelse ${ordreNr(ordre.number)} udstedt (${linjer.length} ${linjer.length === 1 ? "linje" : "linjer"})`,
        author: mig.initials,
      },
    });
    revalidatePath(`/kunder/${kunde.id}`);
  }
  revalidatePath("/ordrer");
  redirect(`/ordrer/${ordre.id}?besked=oprettet`);
}

/** Sletter ordren. PDF'en i kundens filboks bliver liggende. Kræver administrator. */
export async function sletOrdre(id: string) {
  await kraevAdmin();
  const o = await db.order.delete({ where: { id } });
  revalidatePath("/ordrer");
  if (o.companyId) revalidatePath(`/kunder/${o.companyId}`);
  redirect("/ordrer?besked=slettet");
}
