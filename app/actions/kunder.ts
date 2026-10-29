"use server";

/**
 * Kunden: stamdata, tilstand, Hot, licenslinjer (på SUB-nøgler) og kontakter.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { kraevAdmin, kraevSkriv } from "@/lib/auth";
import { formular } from "@/lib/formular";
import { BESLUTNINGSROLLER, FAKTURERING, KONFIDENSER, KUNDESTATUS, PRIORITETER, findKundestatus } from "@/lib/labels";
import { medLoebenummer, erDublet } from "@/lib/nummerserie";
import { naesteKundenummer } from "@/lib/kundenr";
import { delBlandedeKontrakter, kontraktTilProdukt, opretKontrakt, ryddTommeKontrakter } from "@/lib/kontrakter";

function opfrisk(kundeId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/kunder");
  revalidatePath("/produkter");
  if (kundeId) revalidatePath(`/kunder/${kundeId}`);
}

/** Kun http(s)-adresser gemmes som links — aldrig javascript: eller lignende. */
function webadresse(s: string | null) {
  if (!s) return null;
  const med = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(med);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Opretter en ny kunde med et unikt kundenummer. Samme firmanavn og adresse
 * må gerne findes i forvejen — fx en anden afdeling med egen fakturering —
 * så navnet tjekkes ikke for dubletter. Kun Idus konto-id er unikt.
 */
export async function opretKunde(formData: FormData) {
  const mig = await kraevSkriv("kunder");
  const f = formular(formData);
  const name = f.tekst("name");
  if (!name) redirect("/kunder/ny?fejl=navn");
  let id: string;
  try {
    const k = await medLoebenummer(naesteKundenummer, (customerNumber) =>
      db.company.create({
        data: {
          customerNumber,
          name,
          department: f.tekst("department"),
          orgNumber: f.tekst("orgNumber"),
          industry: f.tekst("industry"),
          country: f.tekst("country") ?? "Danmark",
          address: f.tekst("address"),
          zipCode: f.tekst("zipCode"),
          city: f.tekst("city"),
          phone: f.tekst("phone"),
          email: f.tekst("email"),
          website: webadresse(f.tekst("website")),
          accountId: f.tekst("accountId"),
          notes: f.tekst("notes"),
          updatedBy: mig.initials,
        },
        select: { id: true },
      })
    );
    id = k.id;
  } catch (e) {
    if (erDublet(e)) redirect("/kunder/ny?fejl=konto");
    throw e;
  }
  await db.logEntry.create({ data: { companyId: id, kind: "note", content: "Kunden er oprettet", author: mig.initials } });
  opfrisk(id);
  redirect(`/kunder/${id}`);
}

export async function gemKunde(id: string, formData: FormData) {
  await kraevSkriv("kunder");
  const f = formular(formData);
  await db.company.update({
    where: { id },
    data: {
      name: f.tekst("name") ?? "Uden navn",
      department: f.tekst("department"),
      orgNumber: f.tekst("orgNumber"),
      industry: f.tekst("industry"),
      country: f.tekst("country") ?? "Danmark",
      address: f.tekst("address"),
      city: f.tekst("city"),
      zipCode: f.tekst("zipCode"),
      phone: f.tekst("phone"),
      email: f.tekst("email"),
      website: webadresse(f.tekst("website")),
      employees: f.heltal("employees"),
      revenueMdkk: f.tal("revenueMdkk"),
      sizeConfidence: f.valgfrit("sizeConfidence", KONFIDENSER),
      sizeNote: f.tekst("sizeNote"),
      sourceUrl: webadresse(f.tekst("sourceUrl")),
      priority: f.valgfrit("priority", PRIORITETER),
      notes: f.tekst("notes"),
    },
  });
  opfrisk(id);
  redirect(`/kunder/${id}`);
}

/**
 * Opretter eller opdaterer en licenslinje: licens, antal, aftalt pris, periode
 * og SUB-nøgle. "ny" som nøgle = en ny kontrakt (en linje der allerede er alene
 * på sin nøgle, beholder den).
 */
export async function gemLicenslinje(kundeId: string, formData: FormData) {
  const mig = await kraevSkriv("salg");
  const f = formular(formData);
  const id = f.tekst("linjeId");
  const productId = f.tekst("productId");

  const eksisterende = id ? await db.customerProduct.findFirst({ where: { id, companyId: kundeId } }) : null;
  if (id && !eksisterende) return;

  const data = {
    seats: Math.max(0, f.heltal("seats") ?? 0),
    activeSeats: Math.max(0, f.heltal("activeSeats") ?? 0),
    unitPriceMonth: f.tal("unitPriceMonth"),
    billingInterval: f.valg("billingInterval", FAKTURERING, "annual"),
    notes: f.tekst("notes"),
    ...(productId ? { productId } : {}),
    ...(f.dato("startDate") ? { startDate: f.dato("startDate")! } : {}),
    ...(f.har("endDate") ? { endDate: f.dato("endDate") } : {}),
    ...(f.har("termMonths") ? { termMonths: Math.max(1, f.heltal("termMonths") ?? 12) } : {}),
  };

  await db.$transaction(async (tx) => {
    const valgt = f.tekst("contractId");
    let contractId: string | undefined;
    if (valgt === "ny") {
      const alene = eksisterende?.contractId
        ? (await tx.customerProduct.count({ where: { contractId: eksisterende.contractId } })) === 1
        : false;
      contractId = alene ? eksisterende!.contractId! : (await opretKontrakt(tx, kundeId, mig.initials)).id;
    } else if (valgt) {
      const k = await tx.contract.findFirst({ where: { id: valgt, companyId: kundeId }, select: { id: true } });
      contractId = k?.id;
    }
    if (eksisterende) {
      await tx.customerProduct.update({ where: { id: eksisterende.id }, data: { ...data, ...(contractId ? { contractId } : {}) } });
    } else if (productId) {
      // En nøgle hører til ét produkt — har den valgte nøgle et andet produkt, bruges en der passer
      const noegle = contractId ? await kontraktTilProdukt(tx, kundeId, productId, contractId, mig.initials) : (await opretKontrakt(tx, kundeId, mig.initials)).id;
      await tx.customerProduct.create({ data: { companyId: kundeId, ...data, productId, contractId: noegle } });
    }
  });
  // Er en linje flyttet ind under en nøgle med et andet produkt, eller har den skiftet produkt, deles nøglen
  await delBlandedeKontrakter(kundeId);
  await ryddTommeKontrakter(kundeId);
  opfrisk(kundeId);
}

export async function sletLicenslinje(id: string) {
  await kraevSkriv("salg");
  const linje = await db.customerProduct.delete({ where: { id } });
  await ryddTommeKontrakter(linje.companyId);
  opfrisk(linje.companyId);
}

/** Sætter kundens tilstand. Et skift skrives i tilstandsloggen (og dermed i logbogen). */
export async function skiftKundestatus(id: string, formData: FormData) {
  const mig = await kraevSkriv("kunder");
  const f = formular(formData);
  const ny = f.valg("customerStatus", KUNDESTATUS, "stabil");
  const foer = await db.company.findUnique({ where: { id }, select: { customerStatus: true } });
  if (!foer) return;
  await db.company.update({
    where: { id },
    data: {
      customerStatus: ny,
      customerStatusAt: new Date(),
      // Ældre formularer sender stadig en note med
      ...(f.har("customerStatusNote") ? { customerStatusNote: f.tekst("customerStatusNote") } : {}),
    },
  });
  if (foer.customerStatus !== ny) {
    await db.logEntry.create({
      data: { companyId: id, kind: "tilstand", content: `Tilstand: ${findKundestatus(foer.customerStatus).label} → ${findKundestatus(ny).label}`, author: mig.initials },
    });
  }
  opfrisk(id);
}

/**
 * Én linje i tilstandsloggen ("29/10/26 JPR: …"). Dato og initialer gemmes
 * som tidspunkt og forfatter — står de foran teksten, fjernes de. Den nyeste
 * linje bliver også kundens "hvorfor", som vises under kundens navn.
 */
export async function skrivTilstandslog(kundeId: string, formData: FormData) {
  const mig = await kraevSkriv("kunder");
  const raa = formular(formData).tekst("tekst") ?? "";
  const tekst = raa.replace(/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\s+[A-ZÆØÅ0-9]{1,6}:\s*/i, "").trim().slice(0, 500);
  if (!tekst) return;
  await db.$transaction([
    db.logEntry.create({ data: { companyId: kundeId, kind: "tilstand", content: tekst, author: mig.initials } }),
    db.company.update({ where: { id: kundeId }, data: { customerStatusNote: tekst } }),
  ]);
  opfrisk(kundeId);
}

/**
 * "Hot" — mulighed for at hente flere timer lige nu. Sættes af teknikere,
 * vises i sidebjælken og på dashboardene.
 */
export async function skiftHot(id: string, isHot: boolean) {
  const mig = await kraevSkriv("teknik");
  await db.company.update({
    where: { id },
    data: { isHot, hotSince: isHot ? new Date() : null, hotSetBy: isHot ? mig.initials : null },
  });
  opfrisk(id);
}

/**
 * Sletter en kunde og alt der hænger på den (kontakter, licenser, sager,
 * klippekort, tid, logbog, salgsmuligheder, filer). Tilbud og ordrer bliver
 * stående som dokumenter uden kunde. Kan ikke fortrydes — derfor skal kundens
 * navn skrives som bekræftelse.
 */
export async function sletKunde(id: string, formData: FormData) {
  await kraevAdmin();
  const kunde = await db.company.findUnique({ where: { id }, select: { name: true } });
  if (!kunde) redirect("/kunder");
  if (formular(formData).tekst("bekraeft") !== kunde.name) redirect(`/kunder/${id}/slet?fejl=navn`);

  await db.company.delete({ where: { id } });
  revalidatePath("/kunder");
  revalidatePath("/dashboard");
  revalidatePath("/teknik");
  redirect(`/kunder?besked=slettet&navn=${encodeURIComponent(kunde.name)}`);
}

export async function opretKontakt(kundeId: string, formData: FormData) {
  await kraevSkriv("kunder");
  const f = formular(formData);
  const fornavn = f.tekst("firstName");
  if (!fornavn) return;
  await db.contact.create({
    data: {
      companyId: kundeId,
      firstName: fornavn,
      lastName: f.tekst("lastName") ?? "",
      email: f.tekst("email"),
      phone: f.tekst("phone"),
      title: f.tekst("title"),
      decisionRole: f.valgfrit("decisionRole", BESLUTNINGSROLLER),
    },
  });
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/kontakter");
}

export async function sletKontakt(id: string, kundeId: string) {
  await kraevSkriv("kunder");
  await db.contact.deleteMany({ where: { id, companyId: kundeId } });
  revalidatePath(`/kunder/${kundeId}`);
  revalidatePath("/kontakter");
}
