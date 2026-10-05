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

try {
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
