#!/usr/bin/env node
/**
 * Kører en Prisma-kommando mod den database crm-pro.config.json peger på.
 *
 * Uden det her ville "prisma db push" læse .env og ramme den oprindelige
 * placering, selvom du har flyttet databasen under Indstillinger → Database.
 *
 *   node scripts/prisma.mjs db push --accept-data-loss
 *
 * Prisma kaldes som et almindeligt node-script, ikke via .cmd eller npx.
 * Det er med vilje: en sti med mellemrum i ("D:\Claude Test\...") bliver
 * splittet af cmd.exe, og så fejler kommandoen med "'D:\Claude' is not
 * recognized". Uden shell findes problemet ikke.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const rod = process.cwd();
const konfigfil = join(rod, "crm-pro.config.json");
const STANDARD = join("prisma", "crm-pro.db");

let sti = STANDARD;
if (existsSync(konfigfil)) {
  try {
    const k = JSON.parse(readFileSync(konfigfil, "utf8"));
    if (k?.databasePath?.trim()) sti = k.databasePath.trim();
  } catch {
    console.warn("! Kunne ikke læse crm-pro.config.json — bruger standardplaceringen.");
  }
}

const abs = isAbsolute(sti) ? sti : resolve(rod, sti);
const url = `file:${abs.replace(/\\/g, "/")}`;
const kommando = process.argv.slice(2);

console.log(`> prisma ${kommando.join(" ")}`);
console.log(`  database: ${abs}`);

const env = { ...process.env, DATABASE_URL: url };
const prismaJs = join(rod, "node_modules", "prisma", "build", "index.js");

let r;
if (existsSync(prismaJs)) {
  // Ingen shell, ingen citationsproblemer — node får stien som ét argument.
  r = spawnSync(process.execPath, [prismaJs, ...kommando], { stdio: "inherit", env });
} else {
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  r = spawnSync(npxBin, ["prisma", ...kommando], { stdio: "inherit", env });
}

if (r.error) {
  console.error("\n! Kunne ikke starte Prisma:", r.error.message);
  console.error("  Er afhængighederne installeret? Prøv: npm install");
  process.exit(1);
}

if (r.status !== 0) {
  console.error(`\n! Prisma-kommandoen fejlede (kode ${r.status}).`);
  if (kommando.includes("push") && !kommando.includes("--accept-data-loss")) {
    console.error("  Kræver ændringen at data slettes, så kør i stedet: npm run db:upgrade");
  }
}

process.exit(r.status ?? 1);
