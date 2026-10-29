"use server";

import { erEngang } from "@/lib/katalog";
import { db } from "@/lib/db";
import { kraevAdmin, kraevSkriv } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ANTAL_FRIE_LINJER, dokNavn, dokNr, subNr } from "@/lib/dokumenter";
import { aftaleUdloeb, fraIso, maanederMellem, plusDage, slutFraMaaneder } from "@/lib/perioder";
import { kontraktUdloeb, restperiode } from "@/lib/kontrakter";
import { ordrePdf } from "@/lib/ordre-pdf";
import { gemDokumentIFilboks, MAKS_FILSTOERRELSE, saniterFilnavn } from "@/lib/filer";
import { anvendOrdrePaaKunde } from "@/lib/ordre-anvend";
import { tekst, tal, heltal } from "@/lib/formular";
import { medLoebenummer } from "@/lib/nummerserie";


/**
 * Salesforce-link til en Opportunity. Kun fulde https-adresser — så linket
 * altid kan åbnes, og der ikke kan sættes javascript: eller lignende ind.
 * undefined = ugyldigt, null = tomt.
 */
function salesforceLink(v: FormDataEntryValue | null): string | null | undefined {
  const s = tekst(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString().slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

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
  const start = fraIso(tekst(fd.get(`${prefix}start`))) ?? standardStart;
  let mdr = heltal(fd.get(`${prefix}mdr`));
  let slut = fraIso(tekst(fd.get(`${prefix}slut`)));
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
  const mig = await kraevSkriv("salg");
  const kind = formData.get("kind") === "tilbud" ? "tilbud" : "ordre";
  const companyId = tekst(formData.get("companyId"));
  const contractId = tekst(formData.get("contractId"));
  const tilbage = `/ordrer/ny?type=${kind}${companyId ? `&kunde=${companyId}` : ""}${contractId ? `&kontrakt=${contractId}` : ""}`;

  const kunde = companyId ? await db.company.findUnique({ where: { id: companyId } }) : null;
  const recipientName = tekst(formData.get("recipientName")) ?? kunde?.name ?? null;
  if (!recipientName) redirect(`${tilbage}&fejl=modtager`);
  const salesforceUrl = salesforceLink(formData.get("salesforceUrl"));
  if (salesforceUrl === undefined) redirect(`${tilbage}&fejl=salesforce`);
  const kontrakt =
    kunde && contractId
      ? await db.contract.findFirst({
          where: { id: contractId, companyId: kunde.id },
          include: { lines: { where: { isActive: true }, include: { product: true } } },
        })
      : null;

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
        unitPrice: tal(formData.get(`f_pris_${cp.id}`)),
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
    const perpetual = erEngang(pr.licenseModel);
    const p = perpetual ? { start: null, slut: null, mdr: null } : periode(formData, `n_${pr.id}_`, idag);
    linjer.push({
      productId: pr.id,
      customerProductId: null,
      lineKind: "nyt",
      description: linjenavn(pr),
      details: pr.documentText,
      quantity: Math.max(1, heltal(formData.get(`antal_${pr.id}`)) ?? 1),
      unitPrice: tal(formData.get(`pris_${pr.id}`)),
      months: perpetual ? null : p.mdr ?? 12,
      periodStart: p.start,
      periodEnd: p.slut,
      licenseModel: pr.licenseModel,
      sortOrder: linjer.length,
    });
  }

  // 2b. Tilkøb på SUB-nøglen — afregnes fra startdatoen til nøglens udløb (påbegyndte måneder)
  const tilkoeb = kontrakt ? formData.getAll("tilkoeb").filter((v): v is string => typeof v === "string" && v !== "") : [];
  if (kontrakt && tilkoeb.length) {
    const prods = await db.product.findMany({ where: { id: { in: tilkoeb } }, include: { family: true } });
    prods.sort((a, b) => (a.family?.sortOrder ?? 999) - (b.family?.sortOrder ?? 999) || a.sortOrder - b.sortOrder);
    const noeglensUdloeb = kontraktUdloeb(kontrakt.lines, idag);
    for (const pr of prods) {
      const engang = erEngang(pr.licenseModel);
      const egen = kontrakt.lines.find((l) => l.productId === pr.id) ?? null;
      let p: { start: Date | null; slut: Date | null; mdr: number | null } = { start: null, slut: null, mdr: null };
      if (!engang) {
        const udloeb = egen ? aftaleUdloeb(egen, idag) : noeglensUdloeb;
        const start = fraIso(tekst(formData.get(`t_${pr.id}_start`))) ?? idag;
        const rest = udloeb ? restperiode(start, udloeb) : null;
        if (!rest) redirect(`${tilbage}&fejl=udloebet`);
        p = { start: rest.fra, slut: rest.til, mdr: rest.maaneder };
      }
      linjer.push({
        productId: pr.id,
        customerProductId: egen?.id ?? null,
        lineKind: "tilkoeb",
        description: `Tilkøb til ${subNr(kontrakt.subNumber)}: ${linjenavn(pr)}`,
        details: pr.documentText,
        quantity: Math.max(1, heltal(formData.get(`t_antal_${pr.id}`)) ?? 1),
        unitPrice: tal(formData.get(`t_pris_${pr.id}`)),
        months: p.mdr,
        periodStart: p.start,
        periodEnd: p.slut,
        licenseModel: pr.licenseModel,
        sortOrder: linjer.length,
      });
    }
  }

  // 3. Frie linjer
  for (let i = 0; i < ANTAL_FRIE_LINJER; i++) {
    const overskrift = tekst(formData.get(`fri_tekst_${i}`));
    if (!overskrift) continue;
    const p = periode(formData, `fri_${i}_`, null);
    linjer.push({
      productId: null,
      customerProductId: null,
      lineKind: "fri",
      description: overskrift,
      details: tekst(formData.get(`fri_detaljer_${i}`)),
      quantity: Math.max(1, heltal(formData.get(`fri_antal_${i}`)) ?? 1),
      unitPrice: tal(formData.get(`fri_pris_${i}`)),
      months: p.mdr,
      periodStart: p.start,
      periodEnd: p.slut,
      licenseModel: p.mdr ? "sub" : "perpetual",
      sortOrder: linjer.length,
    });
  }
  if (linjer.length === 0) redirect(`${tilbage}&fejl=linjer`);

  const orderDate = fraIso(tekst(formData.get("orderDate"))) ?? idag;
  const ordre = await medLoebenummer(() => naesteNummer(kind), (number) => db.order.create({
    data: {
      kind,
      number,
      companyId: kunde?.id ?? null,
      recipientName,
      recipientAttn: tekst(formData.get("recipientAttn")),
      recipientAddress: tekst(formData.get("recipientAddress")),
      recipientEmail: tekst(formData.get("recipientEmail")),
      reference: tekst(formData.get("reference")),
      intro: tekst(formData.get("intro")),
      orderDate,
      validUntil: kind === "tilbud" ? fraIso(tekst(formData.get("validUntil"))) ?? plusDage(orderDate, 30) : null,
      note: tekst(formData.get("note")),
      vatRate: tal(formData.get("vatRate")) ?? 25,
      senderProfileId: tekst(formData.get("senderProfileId")),
      contractId: kontrakt?.id ?? null,
      salesforceUrl,
      createdBy: mig.initials,
      lines: { create: linjer },
    },
  }));

  if (kunde) {
    if (kind === "ordre" && formData.get("opdater") === "1") await anvendOrdrePaaKunde(ordre.id, mig.initials);
    await arkiver(ordre.id, mig.initials);
    revalidatePath(`/kunder/${kunde.id}`);
  }
  revalidatePath("/ordrer");
  revalidatePath("/fornyelser");
  redirect(`/ordrer/${ordre.id}?besked=oprettet`);
}

/** Laver ordrebekræftelsen ud fra et tilbud — samme linjer, SUB-nøgle og Salesforce-link, nyt ORD-nummer. */
async function ordreFraTilbud(tilbudId: string, initials: string | null, opdater: boolean) {
  const t = await db.order.findUnique({ where: { id: tilbudId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!t || t.kind !== "tilbud") return null;
  const ordre = await medLoebenummer(() => naesteNummer("ordre"), (number) => db.order.create({
    data: {
      kind: "ordre",
      number,
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
      senderProfileId: t.senderProfileId,
      contractId: t.contractId,
      salesforceUrl: t.salesforceUrl,
      status: "godkendt",
      createdBy: initials,
      lines: {
        create: t.lines.map(({ id: _id, orderId: _o, ...l }) => l),
      },
    },
  }));
  if (t.companyId) {
    if (opdater) await anvendOrdrePaaKunde(ordre.id, initials);
    await arkiver(ordre.id, initials);
    revalidatePath(`/kunder/${t.companyId}`);
  }
  revalidatePath("/ordrer");
  revalidatePath("/fornyelser");
  return ordre;
}

/** Laver en ordrebekræftelse ud fra et tilbud — samme linjer, nyt ORD-nummer. */
export async function tilbudTilOrdre(tilbudId: string, formData: FormData) {
  const mig = await kraevSkriv("salg");
  const ordre = await ordreFraTilbud(tilbudId, mig.initials, formData.get("opdater") === "1");
  if (!ordre) redirect("/ordrer");
  redirect(`/ordrer/${ordre.id}?besked=oprettet`);
}

/**
 * Kunden har accepteret tilbuddet. Accepten (fx mailen gemt som PDF eller .msg)
 * gemmes i kundens filboks og knyttes til tilbuddet. Er "lav ordre" valgt,
 * oprettes ordrebekræftelsen med det samme, og licenserne lægges på SUB-nøglen.
 */
export async function godkendTilbud(tilbudId: string, formData: FormData) {
  const mig = await kraevSkriv("salg");
  const t = await db.order.findUnique({ where: { id: tilbudId }, select: { id: true, kind: true, number: true, status: true, companyId: true, salesforceUrl: true } });
  if (!t || t.kind !== "tilbud") redirect("/ordrer");
  if (t.status === "godkendt") redirect(`/ordrer/${t.id}`);

  const sf = salesforceLink(formData.get("salesforceUrl"));
  if (sf === undefined) redirect(`/ordrer/${t.id}?fejl=salesforce`);

  let acceptAttachmentId: string | null = null;
  const fil = formData.get("accept");
  if (fil instanceof File && fil.size > 0) {
    if (!t.companyId) redirect(`/ordrer/${t.id}?fejl=ingen-kunde`);
    if (fil.size > MAKS_FILSTOERRELSE) redirect(`/ordrer/${t.id}?fejl=for-stor`);
    const att = await db.attachment.create({
      data: {
        companyId: t.companyId,
        filename: saniterFilnavn(`Accept ${dokNr(t)} - ${fil.name}`),
        category: "accept",
        mimeType: fil.type || "application/octet-stream",
        sizeBytes: fil.size,
        data: Buffer.from(await fil.arrayBuffer()),
        uploadedBy: mig.initials,
      },
      select: { id: true },
    });
    acceptAttachmentId = att.id;
  }

  const note = tekst(formData.get("acceptNote"));
  await db.order.update({
    where: { id: t.id },
    data: {
      status: "godkendt",
      acceptedAt: fraIso(tekst(formData.get("acceptedAt"))) ?? new Date(),
      acceptedBy: mig.initials,
      acceptAttachmentId,
      ...(sf !== null ? { salesforceUrl: sf } : {}),
    },
  });
  if (t.companyId) {
    await db.logEntry.create({
      data: {
        companyId: t.companyId,
        kind: "aftale",
        content: `Tilbud ${dokNr(t)} godkendt af kunden${acceptAttachmentId ? " — accept gemt i filboksen" : ""}${note ? `. ${note}` : ""}`,
        author: mig.initials,
      },
    });
  }

  if (formData.get("lavOrdre") === "1") {
    const ordre = await ordreFraTilbud(t.id, mig.initials, !!t.companyId);
    if (ordre) redirect(`/ordrer/${ordre.id}?besked=godkendt`);
  }
  if (t.companyId) revalidatePath(`/kunder/${t.companyId}`);
  revalidatePath("/ordrer");
  redirect(`/ordrer/${t.id}?besked=godkendt`);
}

/** Kunden har sagt nej — eller tilbuddet sættes tilbage til åbent. */
export async function skiftTilbudsstatus(tilbudId: string, status: "afvist" | "aaben") {
  const mig = await kraevSkriv("salg");
  const t = await db.order.findUnique({ where: { id: tilbudId }, select: { id: true, kind: true, number: true, status: true, companyId: true } });
  if (!t || t.kind !== "tilbud" || t.status === "godkendt") redirect(`/ordrer/${tilbudId}`);
  await db.order.update({ where: { id: t.id }, data: { status } });
  if (t.companyId) {
    await db.logEntry.create({
      data: { companyId: t.companyId, kind: "aftale", content: `Tilbud ${dokNr(t)} ${status === "afvist" ? "markeret som afvist" : "genåbnet"}`, author: mig.initials },
    });
    revalidatePath(`/kunder/${t.companyId}`);
  }
  revalidatePath("/ordrer");
  redirect(`/ordrer/${t.id}`);
}

/** Sætter eller retter Salesforce-linket på et tilbud eller en ordre. */
export async function gemSalesforceLink(orderId: string, formData: FormData) {
  await kraevSkriv("salg");
  const sf = salesforceLink(formData.get("salesforceUrl"));
  if (sf === undefined) redirect(`/ordrer/${orderId}?fejl=salesforce`);
  const o = await db.order.update({ where: { id: orderId }, data: { salesforceUrl: sf }, select: { companyId: true } });
  if (o.companyId) revalidatePath(`/kunder/${o.companyId}`);
  revalidatePath("/ordrer");
  redirect(`/ordrer/${orderId}`);
}

/** Lægger en allerede oprettet ordrebekræftelse over på kundens aftaler. */
export async function anvendOrdre(id: string) {
  const mig = await kraevSkriv("salg");
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
