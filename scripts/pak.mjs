#!/usr/bin/env node
/**
 * Bygger CRM-Pro til Windows — både som installation og som portabel exe.
 *
 *   npm run dist
 *
 * Rækkefølgen betyder noget:
 *   1. init.sql        — skemaet som ren SQL, så den pakkede app kan oprette
 *                        en tom database uden Prismas kommandolinjeværktøj
 *   2. prisma generate — klienten og motoren
 *   3. next build      — i standalone-tilstand, så serveren kan køre alene
 *   4. electron-builder
 *
 * Første kørsel henter Electron (~150 MB). Det sker kun én gang.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const rod = process.cwd();
const erWindows = process.platform === "win32";

function trin(navn, fil, argv, ekstraMiljoe = {}) {
  console.log(`\n=== ${navn} ===`);
  const r = spawnSync(process.execPath, [fil, ...argv], {
    stdio: "inherit",
    cwd: rod,
    env: { ...process.env, ...ekstraMiljoe },
  });
  if (r.status !== 0) {
    console.error(`\n! ${navn} fejlede.`);
    process.exit(r.status ?? 1);
  }
}

const nextBin = join(rod, "node_modules", "next", "dist", "bin", "next");
const builderBin = join(rod, "node_modules", "electron-builder", "cli.js");

if (!existsSync(nextBin)) {
  console.error("! Finder ikke Next.js. Kør npm install først.");
  process.exit(1);
}
if (!existsSync(builderBin)) {
  console.error("! Finder ikke electron-builder. Kør npm install først.");
  process.exit(1);
}

// .next kan indeholde filer fra en anden tilstand (fx sidste build var ikke
// standalone) og skal altid ryddes friskt. dist/ rører vi IKKE — det er der
// tidligere udgivne exe-filer ligger, og en ny version skal ligge ved siden
// af dem, ikke overskrive dem.
const nextMappe = join(rod, ".next");
if (existsSync(nextMappe)) {
  console.log("Rydder .next/");
  rmSync(nextMappe, { recursive: true, force: true });
}

// Hæv patch-versionen automatisk, så hver build får sit eget filnavn
// (electron-builder.yml bruger ${version} i artifactName). Vil du markere en
// "rigtig" udgivelse med en højere minor/major, ret tallet i package.json
// før du kører npm run dist — den her bumper bare med 1 oven på det.
function haevVersion() {
  const pkgSti = join(rod, "package.json");
  const pkg = JSON.parse(readFileSync(pkgSti, "utf8"));
  const dele = String(pkg.version ?? "0.0.0").split(".").map((d) => parseInt(d, 10) || 0);
  while (dele.length < 3) dele.push(0);
  const foer = dele.join(".");
  dele[2] += 1;
  const ny = dele.join(".");
  pkg.version = ny;
  writeFileSync(pkgSti, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`\n=== Version ===`);
  console.log(`${foer} -> ${ny}`);
  return ny;
}

const version = haevVersion();

trin("Skema som SQL", join(rod, "scripts", "lav-initsql.mjs"), []);
trin("Prisma-klient", join(rod, "scripts", "prisma.mjs"), ["generate"]);
trin("Next-build (standalone)", nextBin, ["build"], { CRMPRO_STANDALONE: "1" });

if (!existsSync(join(rod, ".next", "standalone", "server.js"))) {
  console.error("\n! Standalone-serveren blev ikke bygget. Er CRMPRO_STANDALONE sat?");
  process.exit(1);
}

trin("Electron-pakning", builderBin, ["--win", "nsis", "portable", "--x64"]);

// Manifest til opdateringstjekket i appen (Indstillinger → Opdatering).
// Kopiér den her fil med ud sammen med exe-filen, fx til den samme
// fællesdrev-mappe som databasen ligger på (jf. DELING.md).
const manifest = {
  version,
  udgivet: new Date().toISOString().slice(0, 10),
  fil: `CRM-Pro-portable-${version}.exe`,
};
writeFileSync(join(rod, "dist", "version.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("\n=== Færdig ===");
console.log(`Filerne ligger i:  ${join(rod, "dist")}`);
console.log(`  CRM-Pro-opsaetning-${version}.exe  — installation (anbefales)`);
console.log(`  CRM-Pro-portable-${version}.exe    — portabel, pakker sig ud ved hver start`);
console.log(`  version.json                       — til Indstillinger → Opdatering; kopiér den med`);
if (!erWindows) {
  console.log("\nBemærk: en Windows-exe bygges bedst på Windows. På andre platforme");
  console.log("kræver electron-builder Wine, og resultatet er ikke testet.");
}
