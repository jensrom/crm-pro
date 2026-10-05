/** Brugerroller. Kun superadmin har adgang til Indstillinger. */
export const ROLLER = [
  { key: "bruger", label: "Bruger" },
  { key: "admin", label: "Administrator" },
  { key: "superadmin", label: "Superadministrator" },
] as const;

export type Rolle = (typeof ROLLER)[number]["key"];

export function tolkRolle(v: FormDataEntryValue | null): Rolle {
  return v === "superadmin" ? "superadmin" : v === "admin" ? "admin" : "bruger";
}

export function rolleNavn(rolle: string) {
  return ROLLER.find((r) => r.key === rolle)?.label ?? rolle;
}
