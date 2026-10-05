#!/usr/bin/env node
/**
 * Flytter data fra den lokale CRM-Pro-database (SQLite-filen crm-pro.db) over i
 * Postgres-databasen på Vercel/Neon.
 *
 *   npm run db:flyt -- "D:\Claude\10_Programmer\CRM-Pro-app\CRM-Pro-data\crm-pro.db"
 *
 * Valgfrit:
 *   --filer "<mappe>"   hvor filboksens filer ligger (standard: mappen "filer" ved siden af databasen)
 *   --overskriv         tøm Postgres-databasen først (ellers stopper scriptet, hvis der allerede er kunder)
 *   --fiktiv            gør alle kundedata fiktive undervejs: firmanavne, adresser, CVR, kontonumre,
 *                       mail, telefon og kontaktpersoner erstattes med opdigtede (se scripts/fiktiv.mjs),
 *                       og navne/mails i fritekst (logbog, sager, notater, ordrer) skiftes ud.
 *                       Licenser, priser, branche og historik bevares. Filboksens filer springes over.
 *
 * Forbindelsen tages fra DATABASE_URL_UNPOOLED (eller DATABASE_URL) i .env —
 * hent dem med `vercel env pull .env`. Skemaet skal findes i forvejen
 * (`npm run db:push` eller første deploy på Vercel).
 *
 * Scriptet læser kun fra SQLite-filen; den ændres ikke. Det kan læse både den
 * nuværende og ældre udgaver af databasen — tabeller og kolonner der mangler,
 * får standardværdier. Til sidst køres klargøringen (katalog, SUB-numre m.m.).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { Prisma, PrismaClient } from "@prisma/client";
import { klargoer } from "./klargoering.mjs";
import { fiktivFirma, fiktivPerson } from "./fiktiv.mjs";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js");

// ---------- argumenter ----------
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const vaerdi = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const dbSti = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--filer");
if (!dbSti) {
  console.error('Brug: npm run db:flyt -- "<sti til crm-pro.db>" [--filer "<mappe>"] [--overskriv]');
  process.exit(1);
}
const absDb = resolve(dbSti);
if (!existsSync(absDb)) {
  console.error(`Finder ikke ${absDb}`);
  process.exit(1);
}
const filMappe = resolve(vaerdi("--filer") ?? join(dirname(absDb), "filer"));
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url?.startsWith("postgres")) {
  console.error("DATABASE_URL_UNPOOLED/DATABASE_URL mangler eller er ikke Postgres. Kør `vercel env pull .env` først.");
  process.exit(1);
}

// ---------- forbindelser ----------
const SQL = await initSqlJs();
const kilde = new SQL.Database(readFileSync(absDb));
const prisma = new PrismaClient({ datasources: { db: { url } } });

const tabelFindes = (t) => kilde.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${t}'`).length > 0;
function raekker(t) {
  const r = kilde.exec(`SELECT * FROM "${t}"`);
  if (!r.length) return [];
  const { columns, values } = r[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])));
}

// Rækkefølgen tager højde for fremmednøgler: forældre før børn.
const RAEKKEFOELGE = [
  "Settings", "User", "ProductFamily", "Product", "ProductPrice", "Company", "Contact", "CustomerProduct",
  "LicenseChange", "Deal", "Activity", "Ticket", "TicketComment", "HourBundle", "TimeLog",
  "CustomerNote", "LogEntry", "Attachment", "Order", "OrderLine",
];
const modeller = Object.fromEntries(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const klient = (navn) => prisma[navn[0].toLowerCase() + navn.slice(1)];

function tilDato(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return new Date(v);
  const s = String(v);
  if (/^\d+$/.test(s)) return new Date(Number(s));
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

function konverter(model, raek) {
  const ud = {};
  for (const f of model.fields) {
    if (f.kind !== "scalar") continue;
    const kol = f.dbName ?? f.name;
    if (!(kol in raek)) continue; // ældre database uden kolonnen — Postgres bruger standardværdien
    const v = raek[kol];
    if (v == null) {
      if (!f.isRequired) ud[f.name] = null;
      continue;
    }
    switch (f.type) {
      case "DateTime": ud[f.name] = tilDato(v); break;
      case "Boolean": ud[f.name] = v === 1 || v === true || v === "1" || v === "true"; break;
      case "Int": ud[f.name] = Math.round(Number(v)); break;
      case "Float": ud[f.name] = Number(v); break;
      case "Bytes": ud[f.name] = Buffer.from(v); break;
      default: ud[f.name] = String(v);
    }
  }
  return ud;
}

// ---------- fiktive data (--fiktiv) ----------
const FIKTIV = flag("--fiktiv");
const firmaer = new Map(); // companyId → fiktivt firma
const personer = new Map(); // contactId → fiktiv person
const erstatninger = []; // [rigtig tekst, fiktiv tekst] — længste først

function forberedFiktiv() {
  const kunder = raekker("companies").sort((a, b) => String(a.name).localeCompare(String(b.name), "da"));
  kunder.forEach((k, i) => {
    const f = fiktivFirma(i, { industry: k.industry, country: k.country });
    firmaer.set(k.id, { ...f, land: k.country });
    if (k.name) erstatninger.push([String(k.name), f.navn]);
    if (k.subdomain) erstatninger.push([String(k.subdomain), f.slug]);
  });
  if (tabelFindes("contacts")) {
    const pr = new Map();
    for (const c of raekker("contacts")) {
      const j = pr.get(c.companyId) ?? 0;
      pr.set(c.companyId, j + 1);
      const f = firmaer.get(c.companyId);
      const idx = f ? [...firmaer.keys()].indexOf(c.companyId) : 500 + personer.size;
      const p = fiktivPerson(idx, j, { country: f?.land, firmaSlug: f?.slug });
      personer.set(c.id, p);
      const fuld = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
      if (fuld.length > 3) erstatninger.push([fuld, p.navn]);
      if (c.lastName && String(c.lastName).length > 3) erstatninger.push([String(c.lastName), p.efternavn]);
      if (c.firstName && String(c.firstName).length > 3) erstatninger.push([String(c.firstName), p.fornavn]);
    }
  }
  erstatninger.sort((a, b) => b[0].length - a[0].length);
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function skrub(t) {
  if (t == null) return t;
  let s = String(t);
  // Hele ord, så "Hansen" ikke rammer midt i et andet ord
  for (const [fra, til] of erstatninger) s = s.replace(new RegExp(`(^|[^\\p{L}])${escRe(fra)}(?=$|[^\\p{L}])`, "giu"), (_m, foer) => foer + til);
  s = s.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, (m) => (m.endsWith(".example") ? m : "kontakt@kunde.example"));
  s = s.replace(/(\+?\d[\d ]{7,}\d)/g, "+45 00 00 00 00");
  return s;
}
const skrubFelter = (ny, felter) => felter.forEach((f) => f in ny && (ny[f] = skrub(ny[f])));

const ANONYMISER = {
  Settings(ny) {
    ny.dataSourceNote = "Fiktive demodata: kunder, kontaktpersoner, adresser, CVR, mail og telefon er opdigtede.";
  },
  Company(ny, raa) {
    const f = firmaer.get(raa.id);
    if (!f) return;
    Object.assign(ny, {
      name: f.navn, orgNumber: f.cvr, phone: f.telefon, email: f.mail, website: f.web,
      address: f.vej, city: f.by, zipCode: f.postnr, accountId: f.kontonr, subdomain: f.slug, code: f.kode,
      sizeNote: `Fiktiv virksomhed til demo. CVR ${f.cvr} findes ikke.`, sourceUrl: null, notes: null,
      // Størrelsen sløres, så tallene ikke kan bruges til at genkende kunden
      employees: ny.employees == null ? null : Math.max(1, Math.round((ny.employees * 0.9) / 10) * 10 || 5),
      revenueMdkk: ny.revenueMdkk == null ? null : Math.max(10, Math.round((ny.revenueMdkk * 1.1) / 10) * 10),
    });
    skrubFelter(ny, ["customerStatusNote"]);
  },
  Contact(ny, raa) {
    const p = personer.get(raa.id);
    if (!p) return;
    Object.assign(ny, { firstName: p.fornavn, lastName: p.efternavn, email: p.mail, phone: p.telefon, notes: null });
  },
  CustomerProduct: (ny) => skrubFelter(ny, ["notes"]),
  LicenseChange: (ny) => skrubFelter(ny, ["note"]),
  Deal: (ny) => skrubFelter(ny, ["title", "notes", "lostReason"]),
  Activity: (ny) => skrubFelter(ny, ["subject", "description"]),
  Ticket: (ny) => skrubFelter(ny, ["title", "description"]),
  TicketComment: (ny) => skrubFelter(ny, ["content"]),
  HourBundle: (ny) => skrubFelter(ny, ["name", "notes"]),
  TimeLog: (ny) => skrubFelter(ny, ["description"]),
  CustomerNote: (ny) => skrubFelter(ny, ["title", "details"]),
  LogEntry: (ny) => skrubFelter(ny, ["content"]),
  Order(ny, raa) {
    const f = raa.companyId ? firmaer.get(raa.companyId) : null;
    const anden = f ?? { navn: "Demokunde ApS", vej: "Eksempelvej 1", postnr: "8700", by: "Horsens", slug: "demokunde" };
    const p = fiktivPerson(901, 0, { firmaSlug: anden.slug });
    Object.assign(ny, {
      recipientName: anden.navn,
      recipientAttn: raa.recipientAttn ? p.navn : null,
      recipientAddress: `${anden.vej}\n${anden.postnr} ${anden.by}`,
      recipientEmail: raa.recipientEmail ? p.mail : null,
    });
    skrubFelter(ny, ["reference", "intro", "note"]);
  },
  OrderLine: (ny) => skrubFelter(ny, ["description", "details"]),
};

try {
  if (FIKTIV) {
    forberedFiktiv();
    console.log(`Fiktive data: ${firmaer.size} kunder og ${personer.size} kontaktpersoner får nye identiteter.`);
  }
  const eksisterende = await prisma.company.count();
  if (eksisterende > 0 && !flag("--overskriv")) {
    console.error(`Postgres-databasen har allerede ${eksisterende} kunder. Brug --overskriv for at tømme den først.`);
    process.exit(1);
  }
  if (flag("--overskriv")) {
    console.log("Tømmer Postgres-databasen …");
    for (const navn of [...RAEKKEFOELGE].reverse()) await klient(navn).deleteMany();
  }

  console.log(`Læser ${absDb}`);
  for (const navn of RAEKKEFOELGE) {
    const model = modeller[navn];
    const tabel = model.dbName ?? navn;
    if (!tabelFindes(tabel)) {
      console.log(`  ${tabel}: findes ikke i den gamle database — springes over`);
      continue;
    }
    let data = raekker(tabel).map((r) => ({ raa: r, ny: konverter(model, r) }));
    if (FIKTIV) {
      if (navn === "Attachment") {
        console.log(`  ${tabel}: ${data.length} filer springes over (de kan indeholde rigtige kundedata)`);
        continue;
      }
      for (const d of data) ANONYMISER[navn]?.(d.ny, d.raa);
    }

    // Filboksen: filerne lå på disk ved siden af databasen — nu skal indholdet med i databasen.
    if (navn === "Attachment") {
      let mangler = 0;
      data = data.filter(({ raa, ny }) => {
        const sti = raa.storedPath ? (isAbsolute(raa.storedPath) ? raa.storedPath : join(dirname(filMappe), raa.storedPath)) : null;
        if (sti && existsSync(sti)) {
          ny.data = readFileSync(sti);
          ny.sizeBytes = ny.data.byteLength;
          return true;
        }
        mangler++;
        return false;
      });
      if (mangler) console.log(`  attachments: ${mangler} filer fandtes ikke i ${filMappe} og er sprunget over`);
    }

    const ny = data.map((d) => d.ny);
    for (let i = 0; i < ny.length; i += 200) {
      await klient(navn).createMany({ data: ny.slice(i, i + 200), skipDuplicates: true });
    }
    console.log(`  ${tabel}: ${ny.length}`);
  }

  console.log("Klargør …");
  await klargoer(prisma, (t) => console.log(t));
  console.log("Færdig. Log ind på Vercel-adressen med dine sædvanlige initialer og PIN.");
} finally {
  await prisma.$disconnect();
  kilde.close();
}
