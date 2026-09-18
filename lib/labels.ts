/** Danske etiketter til de kodeværdier der ligger i databasen. */

export const PRIORITET: Record<string, { label: string; variant: "danger" | "warning" | "muted" }> = {
  hoej:   { label: "Høj",    variant: "danger"  },
  middel: { label: "Middel", variant: "warning" },
  lav:    { label: "Lav",    variant: "muted"   },
};

export const KONFIDENS: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  hoej:   { label: "Høj konfidens",    variant: "success" },
  middel: { label: "Middel konfidens", variant: "warning" },
  lav:    { label: "Lav konfidens",    variant: "danger"  },
};

export const KUNDESTATUS = [
  { key: "glad",          label: "Glad",          variant: "success" as const, bg: "#047857" },
  { key: "stabil",        label: "Stabil",        variant: "muted"   as const, bg: "#475569" },
  { key: "opmaerksomhed", label: "Opmærksomhed",  variant: "warning" as const, bg: "#B45309" },
  { key: "problemer",     label: "Problemer",     variant: "danger"  as const, bg: "#B91C1C" },
  { key: "risiko",        label: "Risiko",        variant: "danger"  as const, bg: "#7F1D1D" },
] as const;

export const findKundestatus = (key: string | null | undefined) =>
  KUNDESTATUS.find((s) => s.key === key) ?? KUNDESTATUS[1];

export const SAGSSTATUS = [
  { key: "aaben",                label: "Åben",                  variant: "info"    as const, aaben: true },
  { key: "afventer_kunde",       label: "Afventer kunde",        variant: "warning" as const, aaben: true },
  { key: "afventer_leverandoer", label: "Afventer leverandør",   variant: "warning" as const, aaben: true },
  { key: "loest",                label: "Løst",                  variant: "success" as const, aaben: false },
  { key: "lukket",               label: "Lukket",                variant: "muted"   as const, aaben: false },
] as const;

export const AABNE_SAGSSTATUS = SAGSSTATUS.filter((s) => s.aaben).map((s) => s.key);

export const findSagsstatus = (key: string | null | undefined) =>
  SAGSSTATUS.find((s) => s.key === key) ?? SAGSSTATUS[0];

export const SAGSPRIORITET = [
  { key: "lav",     label: "Lav",     variant: "muted"   as const, rang: 0 },
  { key: "normal",  label: "Normal",  variant: "info"    as const, rang: 1 },
  { key: "hoej",    label: "Høj",     variant: "warning" as const, rang: 2 },
  { key: "kritisk", label: "Kritisk", variant: "danger"  as const, rang: 3 },
] as const;

export const findSagsprioritet = (key: string | null | undefined) =>
  SAGSPRIORITET.find((p) => p.key === key) ?? SAGSPRIORITET[1];

export const NOTAT_KOLONNER = [
  { key: "nu",      label: "Nu",      hjaelp: "Det du er i gang med" },
  { key: "naeste",  label: "Næste",   hjaelp: "Klar til at tage fat i" },
  { key: "venter",  label: "Venter",  hjaelp: "Ligger hos kunden eller en anden" },
  { key: "faerdig", label: "Færdig",  hjaelp: "Afsluttet" },
] as const;

export const NOTAT_SPOR = [
  { key: "salg",   label: "Salg",   bg: "#2563EB" },
  { key: "teknik", label: "Teknik", bg: "#047857" },
] as const;

export const findSpor = (key: string | null | undefined) =>
  NOTAT_SPOR.find((s) => s.key === key) ?? NOTAT_SPOR[0];

export const NOTAT_PRIORITET = [
  { key: "hoej",   label: "Høj",    variant: "danger" as const, rang: 2 },
  { key: "normal", label: "Normal", variant: "muted"  as const, rang: 1 },
  { key: "lav",    label: "Lav",    variant: "muted"  as const, rang: 0 },
] as const;

export const findNotatprioritet = (key: string | null | undefined) =>
  NOTAT_PRIORITET.find((p) => p.key === key) ?? NOTAT_PRIORITET[1];

export const LOGTYPER = [
  { key: "note",     label: "Note" },
  { key: "moede",    label: "Møde" },
  { key: "opkald",   label: "Opkald" },
  { key: "mail",     label: "Mail" },
  { key: "aftale",   label: "Aftale" },
  { key: "advarsel", label: "Advarsel" },
] as const;

export const STADIER = [
  { key: "ny",           label: "Ny" },
  { key: "kvalificeret", label: "Kvalificeret" },
  { key: "tilbud",       label: "Tilbud sendt" },
  { key: "forhandling",  label: "Forhandling" },
  { key: "vundet",       label: "Vundet" },
  { key: "tabt",         label: "Tabt" },
] as const;

export const AKTIVITETSTYPER = [
  { key: "moede",       label: "Møde" },
  { key: "opkald",      label: "Opkald" },
  { key: "mail",        label: "Mail" },
  { key: "opgave",      label: "Opgave" },
  { key: "opfoelgning", label: "Opfølgning" },
  { key: "note",        label: "Note" },
] as const;

export const BESLUTNINGSROLLER = [
  { key: "",                 label: "Ikke angivet" },
  { key: "influencer",       label: "Influencer" },
  { key: "beslutningstager", label: "Beslutningstager" },
  { key: "budgetansvarlig",  label: "Budgetansvarlig" },
  { key: "ambassadoer",      label: "Ambassadør" },
] as const;

export const FAKTURERING = [
  { key: "monthly",   label: "Månedligt" },
  { key: "quarterly", label: "Kvartalsvis" },
  { key: "biannual",  label: "Halvårligt" },
  { key: "annual",    label: "Årligt" },
] as const;

export const label = (liste: readonly { key: string; label: string }[], key: string | null | undefined) =>
  liste.find((x) => x.key === key)?.label ?? key ?? "–";
