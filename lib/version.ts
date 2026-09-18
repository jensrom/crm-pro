import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Programmets egen version — vist under "Om CRM-Pro" og brugt af
 * opdateringstjekket i Indstillinger → Opdatering.
 *
 * Den pakkede app sætter CRMPRO_VERSION (electron/main.js læser den fra
 * Electrons app.getVersion(), som igen kommer fra package.json ved
 * pakning — se scripts/pak.mjs). Kører man fra kildekoden uden Electron
 * (npm run dev), er der ingen der sætter miljøvariablen, og vi læser
 * package.json direkte i stedet.
 */
export function appVersion(): string {
  const fraMiljoe = process.env.CRMPRO_VERSION?.trim();
  if (fraMiljoe) return fraMiljoe;

  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    if (typeof pkg.version === "string" && pkg.version.trim()) return pkg.version.trim();
  } catch {
    /* ingen package.json ved hånden — sker ikke i praksis */
  }
  return "0.0.0";
}
