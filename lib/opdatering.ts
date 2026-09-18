import { existsSync, readFileSync } from "node:fs";
import { laesKonfig } from "@/lib/config";
import { appVersion } from "@/lib/version";

/**
 * version.json — den lille manifest-fil `npm run dist` skriver ved siden af
 * de bygget exe-filer i dist/. Kopiér den med derud hvor du lægger exe-filen
 * (typisk samme fællesdrev som databasen, jf. DELING.md), og peg
 * Indstillinger → Opdatering på den sti.
 */
export type Versionsmanifest = {
  version: string;
  udgivet?: string;
  fil?: string;
  noter?: string;
};

export type OpdateringsStatus = {
  /** Versionen der kører lige nu. */
  installeret: string;
  /** Den konfigurerede sti til version.json — tom hvis ikke sat op endnu. */
  sti: string;
  /** Indholdet af version.json, hvis det kunne læses. */
  nyeste: Versionsmanifest | null;
  erNyereTilgaengelig: boolean;
  /** null = alt fint. Ellers en af: ikke_sat, ikke_fundet, ugyldig. */
  fejl: "ikke_sat" | "ikke_fundet" | "ugyldig" | null;
};

/** "1.4.2" -> 2. Ikke-tal-dele (fx en "-beta"-hale) tæller som 0. */
function delTal(del: string | undefined) {
  const n = parseInt(del ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/** Positiv hvis a er nyere end b, 0 hvis ens, negativ hvis a er ældre. */
export function sammenlignVersion(a: string, b: string) {
  const ad = a.split(".");
  const bd = b.split(".");
  const laengde = Math.max(ad.length, bd.length);
  for (let i = 0; i < laengde; i++) {
    const diff = delTal(ad[i]) - delTal(bd[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Tjekker om der findes en nyere version end den der kører lige nu.
 *
 * Fejler stille — en manglende eller ulæselig manifest-fil (fx fordi
 * fællesdrevet ikke er tilgængeligt lige nu) må aldrig vælte appen, siden
 * dette kaldes på hver sidevisning for opdateringsprikken i menuen.
 */
export function tjekOpdatering(): OpdateringsStatus {
  const installeret = appVersion();

  let sti = "";
  try {
    sti = laesKonfig().updateManifestPath?.trim() ?? "";
  } catch {
    /* konfigurationsfilen kunne ikke læses — behandles som ikke sat op */
  }

  if (!sti) {
    return { installeret, sti: "", nyeste: null, erNyereTilgaengelig: false, fejl: "ikke_sat" };
  }

  try {
    if (!existsSync(sti)) {
      return { installeret, sti, nyeste: null, erNyereTilgaengelig: false, fejl: "ikke_fundet" };
    }
    const nyeste = JSON.parse(readFileSync(sti, "utf8")) as Versionsmanifest;
    if (!nyeste?.version || typeof nyeste.version !== "string") {
      return { installeret, sti, nyeste: null, erNyereTilgaengelig: false, fejl: "ugyldig" };
    }
    return {
      installeret,
      sti,
      nyeste,
      erNyereTilgaengelig: sammenlignVersion(nyeste.version, installeret) > 0,
      fejl: null,
    };
  } catch {
    return { installeret, sti, nyeste: null, erNyereTilgaengelig: false, fejl: "ugyldig" };
  }
}
