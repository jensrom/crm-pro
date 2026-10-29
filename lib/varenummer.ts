/**
 * Varenumre på licenser og ydelser. Genereres af produktets og licensens navn:
 *
 *   Idus + "Idus Online Medium"   → IDUS-ONLINE-MEDIUM
 *   Vektor Asset + "Server-licens" → VEKTOR-ASSET-SERVER-LICENS
 *   Konsulentydelser + "Kursus pr. deltager" → KONSUL-KURSUS-DELTAG
 *
 * Hvert ord forkortes til højst 6 tegn, højst 4 ord, æ/ø/å skrives som AE/OE/AA.
 * Er nummeret optaget, får det -2, -3 … på. Ren logik — bruges både i formularen
 * (forhåndsvisning) og på serveren (det der gemmes).
 */

const FYLD = new Set(["PR", "OG", "AF", "I", "TIL", "MED", "FOR", "THE", "AND", "OF", "A", "EN", "ET", "DEN", "DET"]);

function ord(s: string) {
  return s
    .toUpperCase()
    .replace(/Æ/g, "AE").replace(/Ø/g, "OE").replace(/Å/g, "AA")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^A-Z0-9]+/)
    .filter((w) => w && !FYLD.has(w));
}

export function lavVarenummer(familie: string | null | undefined, navn: string) {
  const f = ord(familie ?? "");
  let n = ord(navn);
  // Starter licensnavnet med produktnavnet ("Idus Online …" under "Idus"), tages det kun med én gang
  if (f.length && f.every((w, i) => n[i] === w)) n = n.slice(f.length);
  const dele = [...f, ...n].map((w) => w.slice(0, 6)).slice(0, 4);
  return dele.join("-") || "VARE";
}

/** Retter et indtastet varenummer til samme form: store bogstaver, tal og bindestreger. */
export function normaliserVarenummer(s: string) {
  return ord(s).join("-").slice(0, 40);
}

/** Første ledige udgave af nummeret. */
export function unikVarenummer(base: string, optaget: Set<string>) {
  if (!optaget.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const kandidat = `${base}-${i}`;
    if (!optaget.has(kandidat)) return kandidat;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

/** Er varenummeret det automatiske (evt. med -2, -3 på) for det navn? */
export function erAutomatisk(sku: string | null | undefined, familie: string | null | undefined, navn: string) {
  if (!sku) return true;
  const base = lavVarenummer(familie, navn);
  return sku === base || new RegExp(`^${base.replace(/[-]/g, "\\-")}-\\d+$`).test(sku);
}
