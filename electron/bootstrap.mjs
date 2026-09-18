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
  for (const t of ["users", "tickets", "hour_bundles", "time_logs", "log_entries", "customer_notes", "ticket_comments"]) {
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
    companies: [["updatedBy", "TEXT"]],
    contacts: [["updatedBy", "TEXT"]],
    products: [["updatedBy", "TEXT"]],
    customer_products: [["updatedBy", "TEXT"]],
    deals: [["updatedBy", "TEXT"]],
    activities: [["updatedBy", "TEXT"]],
    users: [["updatedBy", "TEXT"]],
    tickets: [["updatedBy", "TEXT"]],
    hour_bundles: [["updatedBy", "TEXT"]],
    customer_notes: [["updatedBy", "TEXT"]],
    settings: [["updatedBy", "TEXT"]],
  };
  let tilfoejet = 0;
  for (const [tabel, kolonner] of Object.entries(KOLONNER)) {
    if (!(await tabelFindes(tabel))) continue;
    const info = await db.$queryRawUnsafe(`PRAGMA table_info(${tabel})`);
    const findes = new Set((Array.isArray(info) ? info : []).map((r) => r.name));
    for (const [navn, type] of kolonner) {
      if (findes.has(navn)) continue;
      await db.$executeRawUnsafe(`ALTER TABLE ${tabel} ADD COLUMN ${navn} ${type}`);
      tilfoejet++;
    }
  }
  if (tilfoejet) log(`${tilfoejet} kolonner tilføjet`);

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
