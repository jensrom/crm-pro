/**
 * Klargør databasen før serveren starter.
 *
 * Kører som et almindeligt node-script inde i Electron (ELECTRON_RUN_AS_NODE).
 * Opgaven er snæver med vilje: sørg for at der findes en brugbar database, og
 * lad være med at røre noget der allerede er der.
 *
 *   1. Er databasen tom eller ny, oprettes skemaet fra init.sql
 *   2. Er der ingen produkter, lægges de tre pakker ind
 *   3. Er der ingen kunder, lægges de 43 fra data/kunder.json ind
 *
 * Brugere oprettes ikke — den første laver du selv på opsætningsskærmen.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const rod = process.env.CRMPRO_APP_DIR;
const dataMappe = process.env.CRMPRO_DATA_DIR;
if (!rod || !dataMappe) {
  console.error("bootstrap: CRMPRO_APP_DIR og CRMPRO_DATA_DIR skal være sat");
  process.exit(1);
}

const log = (...a) => console.log("[klargøring]", ...a);

// ---------- konfiguration ----------
mkdirSync(dataMappe, { recursive: true });

const konfigfil = join(dataMappe, "crm-pro.config.json");
let dbSti = join(dataMappe, "crm-pro.db");
if (existsSync(konfigfil)) {
  try {
    const k = JSON.parse(readFileSync(konfigfil, "utf8"));
    if (k?.databasePath?.trim()) {
      const s = k.databasePath.trim();
      dbSti = s.match(/^([a-zA-Z]:[\\/]|[\\/])/) ? s : join(dataMappe, s);
    }
  } catch {
    log("kunne ikke læse crm-pro.config.json — bruger standardplaceringen");
  }
}
mkdirSync(dirname(dbSti), { recursive: true });
process.env.DATABASE_URL = `file:${dbSti.replace(/\\/g, "/")}`;
log("database:", dbSti);

// ---------- Prisma ----------
const klientSti = join(rod, "node_modules", "@prisma", "client", "default.js");
const { PrismaClient } = await import(pathToFileURL(klientSti).href);
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function tabelFindes(navn) {
  const r = await db.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    navn
  );
  return Array.isArray(r) && r.length > 0;
}

try {
  // 1. Skema
  if (!(await tabelFindes("companies"))) {
    const sqlFil = join(rod, "prisma", "init.sql");
    if (!existsSync(sqlFil)) throw new Error(`Finder ikke ${sqlFil}`);
    const sql = readFileSync(sqlFil, "utf8");
    const saetninger = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));
    for (const s of saetninger) await db.$executeRawUnsafe(s);
    log(`skema oprettet (${saetninger.length} sætninger)`);
  } else {
    log("skema findes allerede");
  }

  // Nyere tabeller på en ældre database — tilføj det der mangler.
  const mangler = [];
  for (const t of [
    "users", "tickets", "hour_bundles", "time_logs", "log_entries", "customer_notes", "ticket_comments",
    "attachments", "product_families", "product_prices", "license_changes",
    "orders", "order_lines",
  ]) {
    if (!(await tabelFindes(t))) mangler.push(t);
  }
  if (mangler.length) {
    log("mangler tabeller:", mangler.join(", "));
    const sql = readFileSync(join(rod, "prisma", "init.sql"), "utf8");
    for (const s of sql.split(";").map((x) => x.trim()).filter(Boolean)) {
      // CREATE TABLE-sætninger er skrevet med IF NOT EXISTS-semantik her:
      // vi prøver, og lader fejl for eksisterende tabeller passere.
      try {
        await db.$executeRawUnsafe(s);
      } catch {}
    }
    log("manglende tabeller tilføjet");
  }

  // Nyere kolonner på en ældre database. SQLite kan tilføje en kolonne uden at
  // røre rækkerne, så det her er ufarligt at køre hver gang.
  const KOLONNER = {
    companies: [
      ["updatedBy", "TEXT"],
      ["isHot", "BOOLEAN NOT NULL DEFAULT false"],
      ["hotSince", "DATETIME"],
      ["hotSetBy", "TEXT"],
    ],
    contacts: [["updatedBy", "TEXT"]],
    products: [
      ["updatedBy", "TEXT"],
      ["familyId", "TEXT"],
      ["licenseModel", "TEXT NOT NULL DEFAULT 'sub'"],
      ["oneTimePrice", "REAL"],
      ["documentText", "TEXT"],
    ],
    customer_products: [["updatedBy", "TEXT"], ["subNumber", "INTEGER"], ["termMonths", "INTEGER NOT NULL DEFAULT 12"]],
    orders: [
      ["kind", "TEXT NOT NULL DEFAULT 'ordre'"],
      ["intro", "TEXT"],
      ["validUntil", "DATETIME"],
      ["sourceOrderId", "TEXT"],
      ["appliedAt", "DATETIME"],
    ],
    product_families: [["commercialTerms", "TEXT"], ["generalTerms", "TEXT"]],
    order_lines: [
      ["lineKind", "TEXT NOT NULL DEFAULT 'nyt'"],
      ["details", "TEXT"],
      ["customerProductId", "TEXT"],
      ["periodStart", "DATETIME"],
      ["periodEnd", "DATETIME"],
    ],
    deals: [["updatedBy", "TEXT"]],
    activities: [["updatedBy", "TEXT"]],
    users: [["updatedBy", "TEXT"], ["mobile", "TEXT"]],
    tickets: [["updatedBy", "TEXT"]],
    hour_bundles: [["updatedBy", "TEXT"]],
    customer_notes: [["updatedBy", "TEXT"]],
    settings: [
      ["updatedBy", "TEXT"],
      ...["docCompanyName", "docDepartment", "docCvr", "docAddress", "docZipCity", "docCountry", "docEmail", "docPhone",
        "docWebsite", "docBankInfo", "docPaymentTerms", "docCertText", "docOrderText"].map((k) => [k, "TEXT"]),
      ["docVatRate", "REAL"],
    ],
  };
  let tilfoejet = 0;
  const nyeKolonner = new Set();
  for (const [tabel, kolonner] of Object.entries(KOLONNER)) {
    if (!(await tabelFindes(tabel))) continue;
    const info = await db.$queryRawUnsafe(`PRAGMA table_info(${tabel})`);
    const findes = new Set((Array.isArray(info) ? info : []).map((r) => r.name));
    for (const [navn, type] of kolonner) {
      if (findes.has(navn)) continue;
      await db.$executeRawUnsafe(`ALTER TABLE ${tabel} ADD COLUMN ${navn} ${type}`);
      nyeKolonner.add(`${tabel}.${navn}`);
      tilfoejet++;
    }
  }
  if (tilfoejet) log(`${tilfoejet} kolonner tilføjet`);

  // Unikt indeks på licensnummeret (SUB-nummer). Kan ikke lægges på med
  // ALTER TABLE, så det oprettes separat — findes det, sker der intet.
  await db.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "customer_products_subNumber_key" ON "customer_products"("subNumber")'
  );
  // Tilbud og ordrebekræftelser har hver sin nummerserie: nummeret er unikt pr. type.
  if (await tabelFindes("orders")) {
    await db.$executeRawUnsafe('DROP INDEX IF EXISTS "orders_number_key"');
    await db.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "orders_kind_number_key" ON "orders"("kind", "number")'
    );
  }

  // 2. Produkter
  const antalProdukter = await db.product.count();
  if (antalProdukter === 0) {
    const PAKKER = [
      { id: "idus-ukendt", name: "Ikke angivet", tier: "ukendt", pris: null, sortOrder: 0, icon: "box", color: "graa",
        beskrivelse: "Midlertidig placering. Sæt den rigtige pakke på kunden, så regner budgettet med." },
      { id: "idus-small", name: "Small", tier: "small", pris: 330, sortOrder: 1, icon: "shield", color: "bronze",
        beskrivelse: "Idus Online Small. 330 kr. pr. bruger pr. måned." },
      { id: "idus-medium", name: "Medium", tier: "medium", pris: 550, sortOrder: 2, icon: "award", color: "soelv",
        beskrivelse: "Idus Online Medium. 550 kr. pr. bruger pr. måned." },
      { id: "idus-large", name: "Large", tier: "large", pris: 695, sortOrder: 3, icon: "crown", color: "guld",
        beskrivelse: "Idus Online Large. 695 kr. pr. bruger pr. måned." },
    ];
    for (const p of PAKKER) {
      await db.product.create({
        data: {
          id: p.id, name: p.name, description: p.beskrivelse, sku: p.id.toUpperCase(),
          type: "saas", tier: p.tier, sortOrder: p.sortOrder, icon: p.icon, color: p.color,
          pricePerUserMonth: p.pris,
        },
      });
    }
    log(`${PAKKER.length} pakker oprettet`);
  }

  // 2b. Katalog: licenserne skal hænge under et produkt. Første gang lægges
  //     alle eksisterende licenser under produktet "Idus", og deres nuværende
  //     pris skrives ind som første post i prishistorikken.
  let idusNy = false;
  if ((await db.productFamily.count()) === 0) {
    await db.productFamily.create({
      data: { id: "fam-idus", name: "Idus", description: "Idus Online", sortOrder: 1 },
    });
    idusNy = true;
    log('produktet "Idus" oprettet i kataloget');
  }
  // Idus' betingelser lægges ind én gang: når produktet oprettes, eller når
  // felterne til betingelser lige er kommet til. Derefter er teksten din.
  if (idusNy || nyeKolonner.has("product_families.commercialTerms")) {
    const idus = await db.productFamily.findUnique({ where: { id: "fam-idus" } });
    if (idus && !idus.commercialTerms && !idus.generalTerms) {
      const laes = (f) => {
        const sti = join(rod, "prisma", "betingelser", f);
        return existsSync(sti) ? readFileSync(sti, "utf8").trim() : null;
      };
      await db.productFamily.update({
        where: { id: "fam-idus" },
        data: { commercialTerms: laes("idus-kommercielle.txt"), generalTerms: laes("idus-generelle.txt") },
      });
      log('betingelser lagt ind på "Idus"');
    }
  }
  const uplacerede = await db.product.findMany({ where: { familyId: null }, select: { id: true } });
  if (uplacerede.length) {
    const foerste = await db.productFamily.findFirst({ orderBy: { sortOrder: "asc" } });
    await db.product.updateMany({ where: { familyId: null }, data: { familyId: foerste.id } });
    log(`${uplacerede.length} licenser lagt under "${foerste.name}"`);
  }
  const udenHistorik = await db.product.findMany({ where: { prices: { none: {} } } });
  for (const p of udenHistorik) {
    const pris = p.licenseModel === "perpetual" ? p.oneTimePrice : p.pricePerUserMonth;
    await db.productPrice.create({
      data: {
        productId: p.id,
        price: pris,
        validFrom: p.createdAt,
        appliedAt: new Date(),
        note: "Pris da kataloget blev oprettet",
      },
    });
  }
  if (udenHistorik.length) log(`prishistorik startet for ${udenHistorik.length} licenser`);

  // 2b2. SUB-numre: alle licenslinjer får et fast nummer i oprettelsesrækkefølge.
  {
    const uden = await db.customerProduct.findMany({
      where: { subNumber: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (uden.length) {
      const maks = await db.customerProduct.aggregate({ _max: { subNumber: true } });
      let n = maks._max.subNumber ?? 0;
      for (const l of uden) await db.customerProduct.update({ where: { id: l.id }, data: { subNumber: ++n } });
      log(`${uden.length} licenslinjer fik SUB-nummer`);
    }
  }

  // 2c. Superadministrator. Hele Indstillinger kræver rollen, så der skal
  //     altid være mindst én. Findes der ingen, bliver den ældste aktive
  //     administrator det.
  if ((await db.user.count()) > 0 && (await db.user.count({ where: { role: "superadmin", isActive: true } })) === 0) {
    const aeldste = await db.user.findFirst({
      where: { role: "admin", isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (aeldste) {
      await db.user.update({ where: { id: aeldste.id }, data: { role: "superadmin" } });
      log(`${aeldste.initials} er gjort til superadministrator`);
    }
  }

  // 3. Kunder
  const antalKunder = await db.company.count();
  if (antalKunder === 0) {
    const kundefil = join(rod, "data", "kunder.json");
    if (existsSync(kundefil)) {
      const KONF = { Høj: "hoej", Middel: "middel", Lav: "lav" };
      const kunder = JSON.parse(readFileSync(kundefil, "utf8"));
      for (const k of kunder) {
        const company = await db.company.create({
          data: {
            accountId: k.accountId, name: k.name, industry: k.industry, address: k.address,
            country: k.country, portalCountry: k.portalCountry, subdomain: k.subdomain,
            runningStatus: k.runningStatus, code: k.code, groupCode: k.groupCode,
            currencyCode: k.currencyCode, email: k.email, phone: k.phone,
            website: k.subdomain ? `https://${k.subdomain}.idusonline.com` : null,
            employees: k.employees, revenueMdkk: k.revenueMdkk,
            sizeConfidence: KONF[k.sizeConfidence] ?? null, sizeNote: k.sizeNote, sourceUrl: k.sourceUrl,
          },
        });
        await db.customerProduct.create({
          data: { companyId: company.id, productId: "idus-ukendt", seats: k.seats, activeSeats: k.activeSeats, billingInterval: "annual" },
        });
        if (k.contactName) {
          const dele = String(k.contactName).trim().split(/\s+/);
          await db.contact.create({
            data: {
              companyId: company.id,
              firstName: dele.length === 1 ? dele[0] : dele.slice(0, -1).join(" "),
              lastName: dele.length === 1 ? "" : dele.at(-1),
              email: k.email, phone: k.phone, isPrimary: true,
            },
          });
        }
      }
      log(`${kunder.length} kunder lagt ind`);
    }
  }

  // 4. Indstillinger
  await db.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      dataSourceNote:
        "Licenser og stamdata: Idus Online partnerportal, status Paid, 26. august 2026. " +
        "Antal ansatte og omsætning: CVR via proff.dk, estatistik.dk og ownr.dk samt årsrapporter. " +
        "Størrelsestallene er baggrundsviden om virksomheden og indgår ikke i budget eller scope.",
    },
  });

  log("klar");
  process.exit(0);
} catch (e) {
  console.error("[klargøring] FEJL:", e?.message ?? e);
  process.exit(1);
} finally {
  await db.$disconnect().catch(() => {});
}
