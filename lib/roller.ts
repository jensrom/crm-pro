/**
 * Brugerroller og hvad de må.
 *
 * Hele adgangsmodellen står her ét sted. Sider, menuer og server-actions
 * spørger alle via `rettigheder(rolle)` — så ændres en rolle, ændres den overalt.
 *
 * Områder:
 *   salg    — leads, opportunities, ordreliste, fornyelser, tilkøb, produkter,
 *             licenslinjer, aktiviteter og salgsnotater
 *   teknik  — sager, klippekort, tidsregistrering, Hot og tekniknotater
 *   kunder  — kundekort, stamdata, kontakter, kundestatus, logbog og filer
 */

export const ROLLER = [
  { key: "superadmin",    label: "Superadministrator", beskrivelse: "Alt — inkl. systemindstillinger" },
  { key: "admin",         label: "Administrator",      beskrivelse: "Case officer — læse og skrive i salg og teknik" },
  { key: "tekniker_plus", label: "Tekniker+",          beskrivelse: "Læse og skrive i teknik · læse i salg" },
  { key: "tekniker",      label: "Tekniker",           beskrivelse: "Kun teknik · læse + registrere arbejdstid" },
  { key: "saelger_plus",  label: "Sælger+",            beskrivelse: "Læse og skrive i salg · læse i teknik" },
  { key: "saelger",       label: "Sælger",             beskrivelse: "Kun salg · læse + oprette leads og noter" },
] as const;

export type Rolle = (typeof ROLLER)[number]["key"];

export type Niveau = "ingen" | "laes" | "skriv";

export type Rettigheder = {
  salg: Niveau;
  teknik: Niveau;
  kunder: Niveau;
  /** Må registrere arbejdstid på sager (også en ren Tekniker). */
  tid: boolean;
  /** Må oprette leads, salgsnotater og logbogsposter (også en ren Sælger). */
  leads: boolean;
  /** Systemindstillinger: brugere, katalog, dokumenter, whitelabel, eksport. */
  indstillinger: boolean;
};

const MATRIX: Record<Rolle, Rettigheder> = {
  superadmin:    { salg: "skriv", teknik: "skriv", kunder: "skriv", tid: true,  leads: true,  indstillinger: true },
  admin:         { salg: "skriv", teknik: "skriv", kunder: "skriv", tid: true,  leads: true,  indstillinger: false },
  tekniker_plus: { salg: "laes",  teknik: "skriv", kunder: "skriv", tid: true,  leads: false, indstillinger: false },
  tekniker:      { salg: "ingen", teknik: "laes",  kunder: "laes",  tid: true,  leads: false, indstillinger: false },
  saelger_plus:  { salg: "skriv", teknik: "laes",  kunder: "skriv", tid: false, leads: true,  indstillinger: false },
  saelger:       { salg: "laes",  teknik: "ingen", kunder: "laes",  tid: false, leads: true,  indstillinger: false },
};

/**
 * Ældre brugere har rollen "bruger" fra før rollemodellen. De havde fuld
 * adgang til salg og teknik, så de behandles som Administrator, indtil en
 * superadministrator giver dem en ny rolle.
 */
export function normaliserRolle(rolle: string | null | undefined): Rolle {
  if (rolle && rolle in MATRIX) return rolle as Rolle;
  return "admin";
}

export function rettigheder(rolle: string | null | undefined): Rettigheder {
  return MATRIX[normaliserRolle(rolle)];
}

export const kanLaese = (n: Niveau) => n !== "ingen";
export const kanSkrive = (n: Niveau) => n === "skriv";

export function tolkRolle(v: FormDataEntryValue | null): Rolle {
  return typeof v === "string" && v in MATRIX ? (v as Rolle) : "saelger";
}

export function rolleNavn(rolle: string) {
  return ROLLER.find((r) => r.key === normaliserRolle(rolle))?.label ?? rolle;
}
