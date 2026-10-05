"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { laesSessionKiks } from "@/lib/sessionkiks";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  if (s == null) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const heltal = (v: FormDataEntryValue | null) => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

const startDato = (v: FormDataEntryValue | null) => {
  const m = txt(v)?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
};

function opfrisk(kundeId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/kunder");
  revalidatePath("/produkter");
  if (kundeId) revalidatePath(`/kunder/${kundeId}`);
}

export async function gemKunde(id: string, formData: FormData) {
  await db.company.update({
    where: { id },
    data: {
      name: txt(formData.get("name")) ?? "Uden navn",
      orgNumber: txt(formData.get("orgNumber")),
      industry: txt(formData.get("industry")),
      country: txt(formData.get("country")) ?? "Danmark",
      address: txt(formData.get("address")),
      city: txt(formData.get("city")),
      zipCode: txt(formData.get("zipCode")),
      phone: txt(formData.get("phone")),
      email: txt(formData.get("email")),
      website: txt(formData.get("website")),
      employees: heltal(formData.get("employees")),
      revenueMdkk: num(formData.get("revenueMdkk")),
      sizeConfidence: txt(formData.get("sizeConfidence")),
      sizeNote: txt(formData.get("sizeNote")),
      sourceUrl: txt(formData.get("sourceUrl")),
      priority: txt(formData.get("priority")),
      notes: txt(formData.get("notes")),
    },
  });
  opfrisk(id);
  redirect(`/kunder/${id}`);
}

/** Opretter eller opdaterer en licenslinje: pakke, antal licenser, aftalt pris. */
export async function gemLicenslinje(kundeId: string, formData: FormData) {
  const id = txt(formData.get("linjeId"));
  const productId = txt(formData.get("productId"));
  const data = {
    seats: heltal(formData.get("seats")) ?? 0,
    activeSeats: heltal(formData.get("activeSeats")) ?? 0,
    unitPriceMonth: num(formData.get("unitPriceMonth")),
    billingInterval: txt(formData.get("billingInterval")) ?? "annual",
    notes: txt(formData.get("notes")),
    ...(productId ? { productId } : {}),
    ...(startDato(formData.get("startDate")) ? { startDate: startDato(formData.get("startDate"))! } : {}),
  };
  if (id) await db.customerProduct.update({ where: { id }, data });
  else if (productId) await db.customerProduct.create({ data: { companyId: kundeId, ...data, productId } });
  opfrisk(kundeId);
}

/** Flytter en kunde til en anden pakke — fx ved opgradering. */
export async function skiftPakke(linjeId: string, productId: string) {
  const linje = await db.customerProduct.update({
    where: { id: linjeId },
    data: { productId },
  });
  opfrisk(linje.companyId);
}

export async function sletLicenslinje(id: string) {
  const linje = await db.customerProduct.delete({ where: { id } });
  opfrisk(linje.companyId);
}

/** Sætter kundens tilstand og noterer hvornår og hvorfor. */
export async function skiftKundestatus(id: string, formData: FormData) {
  await db.company.update({
    where: { id },
    data: {
      customerStatus: txt(formData.get("customerStatus")),
      customerStatusNote: txt(formData.get("customerStatusNote")),
      customerStatusAt: new Date(),
    },
  });
  opfrisk(id);
}

/**
 * Slaar "Hot" til/fra -- mulighed for at hente flere timer lige nu.
 * Bruges af teknikere naar en kunde har haardt fokus paa projektet.
 * Ingen admin-krav -- alle der er logget ind kan saette/fjerne den.
 */
export async function skiftHot(id: string, isHot: boolean) {
  const kiks = await laesSessionKiks();
  await db.company.update({
    where: { id },
    // isHot/hotSince/hotSetBy mangler i de genererede Prisma-typer indtil
    // `prisma generate` er koert uden for denne sandbox (se PORTABEL.md).
    data: {
      isHot,
      hotSince: isHot ? new Date() : null,
      hotSetBy: isHot ? (kiks?.initials ?? null) : null,
    } as any,
  });
  opfrisk(id);
}

/**
 * Sletter en kunde og alt der hænger på den: kontakter, licenslinjer, sager,
 * klippekort, tidsposter, logbog og salgsmuligheder. Kan ikke fortrydes —
 * derfor kræver siden at du skriver kundens navn først.
 */
export async function sletKunde(id: string, formData: FormData) {
  const kunde = await db.company.findUnique({ where: { id }, select: { name: true } });
  if (!kunde) redirect("/kunder");

  const bekraeftelse = txt(formData.get("bekraeft"));
  if (bekraeftelse !== kunde.name) {
    redirect(`/kunder/${id}/slet?fejl=navn`);
  }

  await db.company.delete({ where: { id } });
  revalidatePath("/kunder");
  revalidatePath("/dashboard");
  revalidatePath("/teknik");
  redirect(`/kunder?besked=slettet&navn=${encodeURIComponent(kunde.name)}`);
}

export async function opretKontakt(kundeId: string, formData: FormData) {
  const fornavn = txt(formData.get("firstName"));
  if (!fornavn) return;
  await db.contact.create({
    data: {
      companyId: kundeId,
      firstName: fornavn,
      lastName: txt(formData.get("lastName")) ?? "",
      email: txt(formData.get("email")),
      phone: txt(formData.get("phone")),
      title: txt(formData.get("title")),
      decisionRole: txt(formData.get("decisionRole")),
    },
  });
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/kontakter");
}

export async function sletKontakt(id: string, kundeId: string) {
  await db.contact.delete({ where: { id } });
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/kontakter");
}
