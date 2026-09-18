#!/usr/bin/env node
/**
 * Kører CRM-Pro som en almindelig, ren Node-webserver — uden Electron, uden
 * et vindue, uden en bruger der skal have programmet åbent.
 *
 * Til at sætte op på en intern server (eller en stationær maskine der bare
 * står tændt), så alle åbner adressen i deres egen browser i stedet for at
 * hver har deres egen portable installation. Løser samtidig SQLite-over-
 * netværksdrev-risikoen i DELING.md: her er der kun ÉN proces der nogensinde
 * skriver i databasefilen, uanset hvor mange der er logget ind samtidig.
 *
 *   npm run server
 *
 * Miljøvariabler (alle valgfrie):
 *   CRMPRO_DATA_DIR  hvor crm-pro.config.json og databasen ligger.
 *                    Standard: ./server-data ved siden af dette script.
 *   PORT             hvilken port serveren lytter på. Standard: 4000.
 *   HOSTNAME         hvilken adresse den binder til. Standard: 0.0.0.0 —
 *                    altså tilgængelig fra resten af netværket (og VPN'en),
 *                    ikke kun fra selve maskinen.
 *
 * Kræver at der er bygget først (samme standalone-build som exe'en bruger):
 *
 *   npm run dist
 *
 * Den bygger og pakker exe-filerne med samme kørsel — det er harmløst at
 * ignorere dem, hvis det kun er selve serveren du skal bruge.
 */
import { fork } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rod = process.cwd();
const dataMappe = process.env.CRMPRO_DATA_DIR?.trim() || join(rod, "server-data");
const port = process.env.PORT?.trim() || "4000";
const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";

const standaloneServer = join(rod, ".next", "standalone", "server.js");
if (!existsSync(standaloneServer)) {
  console.error("! Finder ikke .next/standalone/server.js.");
  console.error("  Byg først med: npm run dist");
  console.error("  (den pakker også en exe med samme kørsel — det er harmløst at ignorere den her)");
  process.exit(1);
}

mkdirSync(dataMappe, { recursive: true });

// "next build" kopierer IKKE selv de statiske filer ind i standalone-mappen
// (det er dokumenteret Next-adfærd) — electron-builder gør det kun for den
// pakkede exe. Her skal det gøres hver gang, så CSS/JS/ikoner rent faktisk
// findes når serveren kører direkte fra kildekoden.
const standaloneRod = join(rod, ".next", "standalone");
cpSync(join(rod, ".next", "static"), join(standaloneRod, ".next", "static"), { recursive: true });
cpSync(join(rod, "public"), join(standaloneRod, "public"), { recursive: true });

/** Samme trick som electron/main.js — peger Prisma direkte på den udpakkede motor. */
function prismaMiljoe() {
  const motorMappe = join(rod, "node_modules", ".prisma", "client");
  const miljoe = {};
  if (existsSync(motorMappe)) {
    for (const navn of [
      "libquery_engine-debian-openssl-3.0.x.so.node",
      "libquery_engine-darwin.dylib.node",
      "libquery_engine-darwin-arm64.dylib.node",
      "query_engine-windows.dll.node",
    ]) {
      const fuld = join(motorMappe, navn);
      if (existsSync(fuld)) {
        miljoe.PRISMA_QUERY_ENGINE_LIBRARY = fuld;
        break;
      }
    }
  }
  return miljoe;
}

function version() {
  try {
    return JSON.parse(readFileSync(join(rod, "package.json"), "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const basisMiljoe = {
  ...process.env,
  ...prismaMiljoe(),
  NODE_ENV: "production",
  CRMPRO_APP_DIR: rod,
  CRMPRO_DATA_DIR: dataMappe,
  CRMPRO_VERSION: version(),
};

function koerBootstrap() {
  return new Promise((resolve, reject) => {
    console.log("=== Klargør database ===");
    const p = fork(join(rod, "electron", "bootstrap.mjs"), [], {
      env: basisMiljoe,
      cwd: rod,
      stdio: "inherit",
    });
    p.on("error", reject);
    p.on("exit", (kode) => (kode === 0 ? resolve() : reject(new Error(`Klargøringen stoppede med kode ${kode}`))));
  });
}

function startServer() {
  console.log(`\n=== Starter server på http://${hostname}:${port} ===`);
  const p = fork(standaloneServer, [], {
    cwd: join(rod, ".next", "standalone"),
    env: { ...basisMiljoe, PORT: port, HOSTNAME: hostname },
    stdio: "inherit",
  });
  p.on("exit", (kode) => {
    console.error(`\n! Serveren stoppede (kode ${kode}).`);
    process.exit(kode ?? 1);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      p.kill(signal);
      process.exit(0);
    });
  }
}

try {
  await koerBootstrap();
  startServer();
} catch (fejl) {
  console.error("! Kunne ikke starte:", fejl?.message ?? fejl);
  process.exit(1);
}
