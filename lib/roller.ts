/**
 * Brugerroller og hvad de må.
 *
 * Hele adgangsmodellen står her ét sted. Sider, menuer og server-actions
 * spørger alle via `rettigheder(rolle)` — så ændres en rolle, ændres den overalt.
 *
 * Områder:
 *   salg    — leads, opportunities, ordreliste, fornyelser, tilkøb, produkter,
 *             licenslinjer, aktiviteter og salgsnotater
 *   kunder  — kundekort, stamdata, kontakter, kundestatus, Hot, logbog og filer
 *
 * Teknikdelen (sager, klippekort, tidsregistrering) er fjernet fra CRM'et.
 * Data ligger stadig i databasen. De tidligere roller Tekniker og Tekniker+
 * behandles som Sælger.
 */

export const ROLLER = [
  { key: "superadmin",    label: "Superadministrator", beskrivelse: "Alt — inkl. systemindstillinger" },
  { key: "admin",         label: "Administrator",      beskrivelse: "Læse og skrive i alt · kan slette" },
  { key: "saelger_plus",  label: "Sælger+",            beskrivelse: "Som Sælger" },
  { key: "saelger",       label: "Sælger",             beskrivelse: "Hele salget: kunder, tilbud, ordrer, fornyelser og tilkøb · kan ikke slette" },
  { key: "intern_salg",   label: "Intern salg",        beskrivelse: "Bestiller hos leverandører · styrer Klar til intern salg · læse i salg og kunder" },
] as const;

export type Rolle = (typeof ROLLER)[number]["key"];

export type Niveau = "ingen" | "laes" | "skriv";

export type Rettigheder = {
  salg: Niveau;
  kunder: Niveau;
  /** Må oprette leads, salgsnotater og logbogsposter (også en ren Sælger). */
  leads: boolean;
  /** Systemindstillinger: brugere, katalog, dokumenter, whitelabel, eksport. */
  indstillinger: boolean;
  /** Klar til intern salg: bestilling, status og licensdata på godkendte ordrer. */
  intern: boolean;
};

const MATRIX: Record<Rolle, Rettigheder> = {
  superadmin:    { salg: "skriv", kunder: "skriv", leads: true,  indstillinger: true,  intern: true },
  admin:         { salg: "skriv", kunder: "skriv", leads: true,  indstillinger: false, intern: true },
  saelger_plus:  { salg: "skriv", kunder: "skriv", leads: true,  indstillinger: false, intern: false },
  // Sælger kan gennemføre et salg fra ende til anden (kunde, kontakter, tilbud, ordre,
  // fornyelse, tilkøb, opgradering, send til intern salg). Sletning kræver altid admin.
  saelger:       { salg: "skriv", kunder: "skriv", leads: true,  indstillinger: false, intern: false },
  intern_salg:   { salg: "laes",  kunder: "laes",  leads: false, indstillinger: false, intern: true },
};

/** Roller der er fjernet sammen med teknikdelen — brugerne behandles som Sælger. */
const FJERNEDE_ROLLER: Record<string, Rolle> = { tekniker: "saelger", tekniker_plus: "saelger" };

/**
 * Ældre brugere har rollen "bruger" fra før rollemodellen. De havde fuld
 * adgang til alt, så de behandles som Administrator, indtil en
 * superadministrator giver dem en ny rolle.
 */
export function normaliserRolle(rolle: string | null | undefined): Rolle {
  if (rolle && rolle in MATRIX) return rolle as Rolle;
  if (rolle && rolle in FJERNEDE_ROLLER) return FJERNEDE_ROLLER[rolle];
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
