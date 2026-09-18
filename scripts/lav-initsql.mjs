#!/usr/bin/env node
/**
 * Skriver prisma/init.sql — hele skemaet som ren SQL.
 *
 * Den pakkede app har ingen Prisma-CLI med, så første gang programmet startes
 * på en tom database, køres denne fil i stedet for "prisma db push".
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rod = process.cwd();
const prismaJs = join(rod, "node_modules", "prisma", "build", "index.js");

if (!existsSync(prismaJs)) {
  console.error("! Finder ikke Prisma. Kør npm install først.");
  process.exit(1);
}

const r = spawnSync(
  process.execPath,
  [
    prismaJs,
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    join("prisma", "schema.prisma"),
    "--script",
  ],
  { encoding: "utf8", env: { ...process.env, DATABASE_URL: "file:./ubrugt.db" } }
);

if (r.status !== 0 || !r.stdout?.trim()) {
  console.error("! Kunne ikke udlede skemaet som SQL.");
  if (r.stderr) console.error(r.stderr);
  process.exit(1);
}

const maal = join(rod, "prisma", "init.sql");
writeFileSync(maal, r.stdout, "utf8");
console.log(`Skrev ${maal} (${r.stdout.split("\n").length} linjer)`);
