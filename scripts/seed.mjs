#!/usr/bin/env node
/** Kører et script mod den database crm-pro.config.json peger på. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const rod = process.cwd();
const konfigfil = join(rod, "crm-pro.config.json");
let sti = join("prisma", "crm-pro.db");
if (existsSync(konfigfil)) {
  try {
    const k = JSON.parse(readFileSync(konfigfil, "utf8"));
    if (k?.databasePath?.trim()) sti = k.databasePath.trim();
  } catch {
    console.warn("! Kunne ikke læse crm-pro.config.json — bruger standardplaceringen.");
  }
}
const abs = isAbsolute(sti) ? sti : resolve(rod, sti);
const script = process.argv[2];

if (!script || !existsSync(resolve(rod, script))) {
  console.error(`! Finder ikke scriptet: ${script}`);
  process.exit(1);
}

console.log(`> node ${script}`);
console.log(`  database: ${abs}`);

const r = spawnSync(process.execPath, [script], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `file:${abs.replace(/\\/g, "/")}` },
});

if (r.error) {
  console.error("\n! Kunne ikke køre scriptet:", r.error.message);
  process.exit(1);
}
process.exit(r.status ?? 1);
