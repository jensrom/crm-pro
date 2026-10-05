"use server";

import { db } from "@/lib/db";
import { kraevAdmin, kraevBruger } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ANTAL_FRIE_LINJER, dokNavn, dokNr } from "@/lib/dokumenter";
import { fraIso, maanederMellem, plusDage, slutFraMaaneder } from "@/lib/perioder";
import { ordrePdf } from "@/lib/ordre-pdf";
import { gemDokumentIFilboks } from "@/lib/filer";
import { anvendOrdrePaaKunde } from "@/lib/ordre-anvend";

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

/** "Idus · Idus Online Basic" bliver til "Idus Online Basic" — produktnavnet gentages ikke. */
function linjenavn(p: { name: string; family: { name: string } | null }) {
  if (!p.family || p.name.toLowerCase().startsWith(p.family.name.toLowerCase())) return p.name;
  return `${p.family.name} · ${p.name}`;
}

type Linje = {
  productId: string | null;
  customerProductId: string | null;
  lineKind: string;
  description: string;
  details: string | null;
  quantity: number;
  unitPrice: number | null;
  months: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  licenseModel: string;
  sortOrder: number;
};

/** Læser start/måneder/slut fra periodeudregneren. Måneder vinder over slutdato, hvis kun én er sat. */
function periode(fd: FormData, prefix: string, standardStart: Date | null) {
  const start = fraIso(txt(fd.get(`${prefix}start`))) ?? standardStart;
  let mdr = heltal(fd.get(`${prefix}mdr`));
  let slut = fraIso(txt(fd.get(`${prefix}slut`)));
  if (start && mdr && mdr > 0 && !slut) slut = slutFraMaaneder(start, mdr);
  if (start && slut && !(mdr && mdr > 0)) mdr = maanederMellem(start, slut);
  return { start: mdr ? start : null, slut: mdr ? slut : null, mdr: mdr && mdr > 0 ? mdr : null };
}

async function naesteNummer(kind: string) {
  const sidste = await db.order.aggregate({ where: { kind }, _max: { number: true } });
  return (sidste._max.number ?? 0) + 1;
}

/** Gemmer PDF'en i kundens filboks og noterer dokumentet i logbogen. */
async function arkiver(orderId: string, initials: string | null) {
  const pdf = await ordrePdf(orderId);
  if (!pdf || !pdf.ordre.companyId) return;
  const attId = await gemDokumentIFilboks(
    pdf.ordre.companyId,
    pdf.navn,
    pdf.bytes,
    pdf.ordre.kind === "tilbud" ? "tilbud" : "ordre",
    initials
  );
  await db.order.update({ where: { id: orderId }, data: { attachmentId: attId } });
  await db.logEntry.create({
    data: {
      companyId: pdf.ordre.companyId,
      kind: "aftale",
      content: `${dokNavn(pdf.ordre.kind)} ${dokNr(pdf.ordre)} udstedt (${pdf.ordre.lines.length} ${pdf.ordre.lines.length === 1 ? "linje" : "linjer"})`,
      author: initials,
    },
  });
}

/**
 * Opretter et tilbud eller en ordrebekræftelse.
 *
 * Fornyelser:  "forny" = kundens licenslinje-id, felter f_antal_<id>, f_pris_<id>, f_<id>_start/mdr/slut
 * Nye licenser: "vaelg" = productId, felter antal_<id>, pris_<id>, n_<id>_start/mdr/slut
 * Frie linjer: fri_tekst_<n>, fri_antal_<n>, fri_pris_<n>, fri_<n>_start/mdr/slut
 */
export async function opretOrdre(formData: FormData) {
  const mig = await kraevBruger();
  const kind = formData.get("kind") === "tilbud" ? "tilbud" : "ordre";
  const companyId = txt(formData.get("companyId"));
  const tilbage = `/ordrer/ny?type=${kind}${companyId ? `&kunde=${companyId}` : ""}`;

  const kunde = companyId ? await db.company.findUnique({ where: { id: companyId } }) : null;
  const recipientName = txt(formData.get("recipientName")) ?? kunde?.name ?? null;
  if (!recipientName) redirect(`${tilbage}&fejl=modtager`);

  const idag = new Date();
  const linjer: Linje[] = [];

  // 1. Fornyelser af kundens eksisterende licenser
  const fornyIds = formData.getAll("forny").filter((v): v is string => typeof v === "string" && v !== "");
  if (fornyIds.length && kunde) {
    const cps = await db.customerProduct.findMany({
      where: { id: { in: fornyIds }, companyId: kunde.id },
      include: { product: { include: { family: true } } },
    });
    cps.sort((a, b) => (a.product.family?.sortOrder ?? 999) - (b.product.family?.sortOrder ?? 999) || a.product.sortOrder - b.product.sortOrder);
    for (const cp of cps) {
      const p = periode(formData, `f_${cp.id}_`, idag);
      linjer.push({
        productId: cp.productId,
        customerProductId: cp.id,
        lineKind: "fornyelse",
        description: `Fornyelse: ${linjenavn(cp.product)}`,
        details: cp.product.documentText,
        quantity: Math.max(1, heltal(formData.get(`f_antal_${cp.id}`)) ?? cp.seats),
        unitPrice: num(formData.get(`f_pris_${cp.id}`)),
        months: p.mdr ?? cp.termMonths,
        periodStart: p.start,
        periodEnd: p.slut,
        licenseModel: "sub",
        sortOrder: linjer.length,
      });
    }
  }

  // 2. Nye licenser / tilkøb fra kataloget
  const valgte = formData.getAll("vaelg").filter((v): v is string => typeof v === "string" && v !== "");
  const produkter = valgte.length ? await db.product.findMany({ where: { id: { in: valgte } }, include: { family: true } }) : [];
  produkter.sort((a, b) => (a.family?.sortOrder ?? 999) - (b.family?.sortOrder ?? 999) || a.sortOrder - b.sortOrder);
  for (const pr of produkter) {
    const perpetual = pr.licenseModel === "perpetual";
    const p = perpetual ? { start: null, slut: null, mdr: null } : periode(formData, `n_${pr.id}_`, idag);
    linjer.push({
      productId: pr.id,
      customerProductId: null,
      lineKind: "nyt",
      description: linjenavn(pr),
      details: pr.documentText,
      quantity: Math.max(1, heltal(formData.get(`antal_${pr.id}`)) ?? 1),
      unitPrice: num(formData.get(`pris_${pr.id}`)),
      months: perpetual ? null : p.mdr ?? 12,
      periodStart: p.start,
      periodEnd: p.slut,
      licenseModel: pr.licenseModel,
      sortOrder: linjer.length,
    });
  }

  // 3. Frie linjer
  for (let i = 0; i < ANTAL_FRIE_LINJER; i++) {
    const tekst = txt(formData.get(`fri_tekst_${i}`));
    if (!tekst) continue;
    const p = periode(formData, `fri_${i}_`, null);
    linjer.push({
      productId: null,
      customerProductId: null,
      lineKind: "fri",
      description: tekst,
      details: txt(formData.get(`fri_detaljer_${i}`)),
      quantity: Math.max(1, heltal(formData.get(`fri_antal_${i}`)) ?? 1),
      unitPrice: num(formData.get(`fri_pris_${i}`)),
      months: p.mdr,
      periodStart: p.start,
      periodEnd: p.slut,
      licenseModel: p.mdr ? "sub" : "perpetual",
      sortOrder: linjer.length,
    });
  }
  if (linjer.length === 0) redirect(`${tilbage}&fejl=linjer`);

  const orderDate = fraIso(txt(formData.get("orderDate"))) ?? idag;
  const ordre = await db.order.create({
    data: {
      kind,
      number: await naesteNummer(kind),
      companyId: kunde?.id ?? null,
      recipientName,
      recipientAttn: txt(formData.get("recipientAttn")),
      recipientAddress: txt(formData.get("recipientAddress")),
      recipientEmail: txt(formData.get("recipientEmail")),
      reference: txt(formData.get("reference")),
      intro: txt(formData.get("intro")),
      orderDate,
      validUntil: kind === "tilbud" ? fraIso(txt(formData.get("validUntil"))) ?? plusDage(orderDate, 30) : null,
      note: txt(formData.get("note")),
      vatRate: num(formData.get("vatRate")) ?? 25,
      createdBy: mig.initials,
      lines: { create: linjer },
    },
  });

  if (kunde) {
    if (kind === "ordre" && formData.get("opdater") === "1") await anvendOrdrePaaKunde(ordre.id, mig.initials);
    await arkiver(ordre.id, mig.initials);
    revalidatePath(`/kunder/${kunde.id}`);
  }
  revalidatePath("/ordrer");
  revalidatePath("/fornyelser");
  redirect(`/ordrer/${ordre.id}?besked=oprettet`);
}

/** Laver en ordrebekræftelse ud fra et tilbud — samme linjer, nyt ORD-nummer. */
export async function tilbudTilOrdre(tilbudId: string, formData: FormData) {
  const mig = await kraevBruger();
  const t = await db.order.findUnique({ where: { id: tilbudId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!t || t.kind !== "tilbud") redirect("/ordrer");
  const ordre = await db.order.create({
    data: {
      kind: "ordre",
      number: await naesteNummer("ordre"),
      companyId: t.companyId,
      recipientName: t.recipientName,
      recipientAttn: t.recipientAttn,
      recipientAddress: t.recipientAddress,
      recipientEmail: t.recipientEmail,
      reference: t.reference,
      intro: t.intro,
      orderDate: new Date(),
      note: t.note,
      vatRate: t.vatRate,
      sourceOrderId: t.id,
      createdBy: mig.initials,
      lines: {
        create: t.lines.map(({ id: _id, orderId: _o, ...l }) => l),
      },
    },
  });
  if (t.companyId) {
    if (formData.get("opdater") === "1") await anvendOrdrePaaKunde(ordre.id, mig.initials);
    await arkiver(ordre.id, mig.initials);
    revalidatePath(`/kunder/${t.companyId}`);
  }
  revalidatePath("/ordrer");
  redirect(`/ordrer/${ordre.id}?besked=oprettet`);
}

/** Lægger en allerede oprettet ordrebekræftelse over på kundens aftaler. */
export async function anvendOrdre(id: string) {
  const mig = await kraevBruger();
  const n = await anvendOrdrePaaKunde(id, mig.initials);
  const o = await db.order.findUnique({ where: { id }, select: { companyId: true } });
  if (o?.companyId) revalidatePath(`/kunder/${o.companyId}`);
  revalidatePath("/fornyelser");
  redirect(`/ordrer/${id}?besked=${n ? "anvendt" : "intet"}`);
}

/** Sletter dokumentet. PDF'en i kundens filboks og ændringer på kunden bliver stående. Kræver administrator. */
export async function sletOrdre(id: string) {
  await kraevAdmin();
  const o = await db.order.delete({ where: { id } });
  revalidatePath("/ordrer");
  if (o.companyId) revalidatePath(`/kunder/${o.companyId}`);
  redirect("/ordrer?besked=slettet");
}
