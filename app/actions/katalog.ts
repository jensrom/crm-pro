"use server";

/**
 * Katalog: produkter (familier) og licenserne under dem, inkl. prisændringer.
 * Alt her kræver superadministrator.
 */
import { db } from "@/lib/db";
import { kraevSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
const model = (v: FormDataEntryValue | null) => (v === "perpetual" ? "perpetual" : "sub");

/** "2026-10-05" → lokal midnat den dag. Tom/ugyldig = nu. */
function datoFra(v: FormDataEntryValue | null) {
  const s = txt(v);
  if (!s) return new Date();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Dags dato tæller som "nu", så ændringen træder i kraft med det samme.
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);
  return d.getTime() === idag.getTime() ? new Date() : d;
}

function opfrisk() {
  revalidatePath("/", "layout");
  revalidatePath("/indstillinger/katalog");
  revalidatePath("/produkter");
  revalidatePath("/kunder");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  revalidatePath("/tilkoeb");
}

const KAT = "/indstillinger/katalog";

// ---------- Produkter (familier) ----------

export async function opretProduktFamilie(formData: FormData) {
  await kraevSuperAdmin();
  const name = txt(formData.get("name"));
  if (!name) redirect(`${KAT}?fejl=navn`);
  const sidste = await db.productFamily.findFirst({ orderBy: { sortOrder: "desc" } });
  const f = await db.productFamily.create({
    data: {
      name,
      description: txt(formData.get("description")),
      sortOrder: Math.round(num(formData.get("sortOrder")) ?? (sidste?.sortOrder ?? 0) + 1),
    },
  });
  opfrisk();
  redirect(`${KAT}?produkt=${f.id}&besked=produkt-oprettet`);
}

export async function gemProduktFamilie(id: string, formData: FormData) {
  await kraevSuperAdmin();
  const name = txt(formData.get("name"));
  await db.productFamily.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      description: txt(formData.get("description")),
      commercialTerms: txt(formData.get("commercialTerms")),
      generalTerms: txt(formData.get("generalTerms")),
      sortOrder: Math.round(num(formData.get("sortOrder")) ?? 0),
      isActive: formData.get("isActive") === "on",
    },
  });
  opfrisk();
  redirect(`${KAT}?produkt=${id}&besked=gemt`);
}

/** Et produkt kan kun slettes, når der ikke længere ligger licenser under det. */
export async function sletProduktFamilie(id: string) {
  await kraevSuperAdmin();
  const antal = await db.product.count({ where: { familyId: id } });
  if (antal > 0) redirect(`${KAT}?produkt=${id}&fejl=har-licenser`);
  await db.productFamily.delete({ where: { id } });
  opfrisk();
  redirect(`${KAT}?besked=produkt-slettet`);
}

// ---------- Licenser ----------

export async function opretLicens(formData: FormData) {
  const mig = await kraevSuperAdmin();
  const name = txt(formData.get("name"));
  const familyId = txt(formData.get("familyId"));
  if (!name || !familyId) redirect(`${KAT}?fejl=licens-mangler`);

  const licenseModel = model(formData.get("licenseModel"));
  const pris = num(formData.get("price"));
  const sidste = await db.product.findFirst({ where: { familyId }, orderBy: { sortOrder: "desc" } });
  const nu = new Date();

  const p = await db.product.create({
    data: {
      name,
      familyId,
      licenseModel,
      pricePerUserMonth: licenseModel === "sub" ? pris : null,
      oneTimePrice: licenseModel === "perpetual" ? pris : null,
      sku: txt(formData.get("sku")),
      description: txt(formData.get("description")),
      documentText: txt(formData.get("documentText")),
      tier: "egen",
      icon: txt(formData.get("icon")) ?? "package",
      color: txt(formData.get("color")) ?? "graa",
      sortOrder: Math.round(num(formData.get("sortOrder")) ?? (sidste?.sortOrder ?? 0) + 1),
    },
  });
  await db.productPrice.create({
    data: { productId: p.id, price: pris, validFrom: nu, appliedAt: nu, note: "Pris ved oprettelse", createdBy: mig.initials },
  });
  opfrisk();
  redirect(`${KAT}?licens=${p.id}&besked=licens-oprettet`);
}

/**
 * Stamdata på en licens. Prisen rettes IKKE her — den ændres med en
 * prisændring, så historikken bevares.
 */
export async function gemLicens(id: string, formData: FormData) {
  await kraevSuperAdmin();
  const name = txt(formData.get("name"));
  const familyId = txt(formData.get("familyId"));
  const foer = await db.product.findUnique({ where: { id } });
  if (!foer) redirect(`${KAT}?fejl=findes-ikke`);

  const nyModel = model(formData.get("licenseModel"));
  const skifter = nyModel !== foer.licenseModel;

  await db.product.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(familyId ? { familyId } : {}),
      licenseModel: nyModel,
      // Ved skift af licensmodel følger den nuværende pris med over i det nye felt.
      ...(skifter
        ? nyModel === "perpetual"
          ? { oneTimePrice: foer.pricePerUserMonth, pricePerUserMonth: null }
          : { pricePerUserMonth: foer.oneTimePrice, oneTimePrice: null }
        : {}),
      sku: txt(formData.get("sku")),
      description: txt(formData.get("description")),
      documentText: txt(formData.get("documentText")),
      icon: txt(formData.get("icon")) ?? "package",
      color: txt(formData.get("color")) ?? "graa",
      sortOrder: Math.round(num(formData.get("sortOrder")) ?? 0),
      isActive: formData.get("isActive") === "on",
    },
  });
  opfrisk();
  redirect(`${KAT}?licens=${id}&besked=gemt${skifter ? "&model=skiftet" : ""}`);
}

/**
 * Prisændring. Gælder fra den valgte dato:
 *   • i dag eller tidligere → træder i kraft med det samme
 *   • en fremtidig dato     → venter og lægges over automatisk, når datoen nås
 *
 * Kunder med en aftalt pris på deres linje berøres ikke — de følger ikke listeprisen.
 */
export async function aendrPris(id: string, formData: FormData) {
  const mig = await kraevSuperAdmin();
  const p = await db.product.findUnique({ where: { id } });
  if (!p) redirect(`${KAT}?fejl=findes-ikke`);

  const pris = num(formData.get("price"));
  const validFrom = datoFra(formData.get("validFrom"));
  const nu = new Date();
  const straks = validFrom.getTime() <= nu.getTime();

  await db.productPrice.create({
    data: {
      productId: id,
      price: pris,
      validFrom,
      appliedAt: straks ? nu : null,
      note: txt(formData.get("note")),
      createdBy: mig.initials,
    },
  });
  if (straks) {
    await db.product.update({
      where: { id },
      data: p.licenseModel === "perpetual" ? { oneTimePrice: pris } : { pricePerUserMonth: pris },
    });
  }
  opfrisk();
  redirect(`${KAT}?licens=${id}&besked=${straks ? "pris-aendret" : "pris-planlagt"}`);
}

/** Fortryder en planlagt prisændring, der endnu ikke er trådt i kraft. */
export async function annullerPrisaendring(prisId: string) {
  await kraevSuperAdmin();
  const pp = await db.productPrice.findUnique({ where: { id: prisId } });
  if (!pp) redirect(KAT);
  if (pp.appliedAt == null) await db.productPrice.delete({ where: { id: prisId } });
  opfrisk();
  redirect(`${KAT}?licens=${pp.productId}&besked=pris-annulleret`);
}
