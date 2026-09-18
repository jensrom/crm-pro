import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * Programmets egne indstillinger — dem der ikke kan bo i databasen,
 * fordi de bestemmer hvor databasen ligger.
 *
 * Filen hedder crm-pro.config.json og ligger i projektmappen ved siden af
 * package.json. Flytter du hele mappen, følger konfigurationen med.
 */
export type AppKonfig = {
  /** Sti til SQLite-filen. Relativ sti regnes ud fra projektmappen. */
  databasePath: string;
  /** Nøgle der signerer login-cookien. Skabes automatisk første gang. */
  authSecret: string;
  /**
   * Sti til version.json — den lille manifest-fil `npm run dist` skriver ved
   * siden af de bygget exe-filer. Tom streng = opdateringstjek er slået fra.
   * Se lib/opdatering.ts.
   */
  updateManifestPath: string;
};

/**
 * Hvor data ligger.
 *
 * I den portable udgave sætter Electron CRMPRO_DATA_DIR til mappen ved siden af
 * exe-filen, så konfiguration og database følger med USB-nøglen. Kører du fra
 * kildekoden, er det projektmappen som før.
 */
export const dataMappe = () => process.env.CRMPRO_DATA_DIR?.trim() || process.cwd();

const KONFIGFIL = join(dataMappe(), "crm-pro.config.json");
const STANDARD_DB = process.env.CRMPRO_DATA_DIR
  ? join(dataMappe(), "crm-pro.db")
  : join("prisma", "crm-pro.db");

function skrivKonfig(k: AppKonfig) {
  writeFileSync(KONFIGFIL, JSON.stringify(k, null, 2) + "\n", "utf8");
}

export function laesKonfig(): AppKonfig {
  if (existsSync(KONFIGFIL)) {
    try {
      const raa = JSON.parse(readFileSync(KONFIGFIL, "utf8")) as Partial<AppKonfig>;
      const k: AppKonfig = {
        databasePath: raa.databasePath?.trim() || STANDARD_DB,
        authSecret: raa.authSecret || randomBytes(32).toString("hex"),
        updateManifestPath: raa.updateManifestPath?.trim() || "",
      };
      if (!raa.authSecret) skrivKonfig(k);
      return k;
    } catch {
      // Ødelagt konfigurationsfil skal ikke vælte programmet — vi falder tilbage
      // til standarden og skriver en frisk fil.
    }
  }
  const ny: AppKonfig = { databasePath: STANDARD_DB, authSecret: randomBytes(32).toString("hex"), updateManifestPath: "" };
  try {
    skrivKonfig(ny);
  } catch {
    /* skrivebeskyttet mappe — kør videre med værdierne i hukommelsen */
  }
  return ny;
}

/** Den absolutte sti databasen faktisk læses fra. */
export function databaseSti(k: AppKonfig = laesKonfig()) {
  return isAbsolute(k.databasePath) ? k.databasePath : resolve(dataMappe(), k.databasePath);
}

/** Prisma vil have en file:-URL med skråstreger, også på Windows. */
export function databaseUrl(k: AppKonfig = laesKonfig()) {
  return `file:${databaseSti(k).replace(/\\/g, "/")}`;
}

export function gemDatabaseSti(nySti: string) {
  const k = laesKonfig();
  skrivKonfig({ ...k, databasePath: nySti.trim() });
}

/** Sti til version.json for opdateringstjekket. Tom streng slår tjekket fra. */
export function gemOpdateringsSti(nySti: string) {
  const k = laesKonfig();
  skrivKonfig({ ...k, updateManifestPath: nySti.trim() });
}

export function konfigfilSti() {
  return KONFIGFIL;
}

/** Findes mappen, og kan der skrives i den? Bruges før en sti tages i brug. */
export function tjekSti(sti: string): { ok: boolean; grund?: string; findes: boolean; mappe: string } {
  const abs = isAbsolute(sti) ? sti : resolve(dataMappe(), sti);
  const mappe = dirname(abs);
  const findes = existsSync(abs);
  if (!existsSync(mappe)) {
    try {
      mkdirSync(mappe, { recursive: true });
    } catch {
      return { ok: false, grund: "Mappen findes ikke og kunne ikke oprettes.", findes, mappe };
    }
  }
  try {
    const proeve = join(mappe, `.crm-pro-skrivetest-${Date.now()}`);
    writeFileSync(proeve, "x");
    // Oprydning må gerne fejle; testfilen er tom og harmløs.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("node:fs").unlinkSync(proeve);
    } catch {}
  } catch {
    return { ok: false, grund: "Der kan ikke skrives i mappen.", findes, mappe };
  }
  return { ok: true, findes, mappe };
}

/** Ser stien ud til at ligge i en mappe der synkroniseres? Det er den farlige situation. */
export function synkroniseretAdvarsel(sti: string) {
  const s = sti.toLowerCase();
  const mistaenkte = ["onedrive", "sharepoint", "dropbox", "google drive", "googledrive", "icloud", "nextcloud", "box sync"];
  const fundet = mistaenkte.find((m) => s.includes(m));
  return fundet ?? null;
}

/** UNC-sti eller netværksdrev? Så gælder en-ad-gangen-reglen. */
export function netvaerksAdvarsel(sti: string) {
  return sti.startsWith("\\\\") || sti.startsWith("//");
}
