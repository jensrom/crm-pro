/**
 * Læsning af formularfelter i server actions — ét sted, ens overalt.
 *
 *   const f = formular(formData);
 *   f.tekst("name")              → trimmet tekst eller null
 *   f.tal("price")               → 1.250,50 / 1250.5 / 1 250 → 1250.5 (dansk talformat)
 *   f.heltal("seats")            → afrundet tal eller null
 *   f.dato("dueAt")              → "2026-10-29" → lokal middag den dag (ingen tidszone-forskydning)
 *   f.flueben("isActive")        → true når feltet er sat ("on", "1", "true")
 *   f.valg("stage", STADIER, "ny") → kun en af de tilladte nøgler, ellers standarden
 *   f.alle("forny")              → alle ikke-tomme værdier for et felt der går igen
 *
 * Alt der kommer fra en formular er utroværdigt. Derfor går tal, datoer og
 * faste valglister altid gennem disse funktioner og aldrig direkte i databasen.
 */

type Felt = FormDataEntryValue | null;
type Noegler = readonly { key: string }[] | readonly string[];

export function tekst(v: Felt): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Dansk og engelsk talformat: "1.250,50", "1250.5", "1 250". */
export function tal(v: Felt): number | null {
  const s = tekst(v);
  if (s == null) return null;
  const renset = s
    .replace(/\s|kr\.?/gi, "")
    // Punktum som tusindtalsseparator (1.250 eller 1.250.000) fjernes
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(renset);
  return Number.isFinite(n) ? n : null;
}

export function heltal(v: Felt): number | null {
  const n = tal(v);
  return n == null ? null : Math.round(n);
}

/** "yyyy-mm-dd" → lokal middag. Middag, så hverken sommertid eller UTC flytter datoen. */
export function dato(v: Felt): Date | null {
  const m = tekst(v)?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function flueben(v: Felt): boolean {
  return v === "on" || v === "1" || v === "true";
}

/** Kun en af de tilladte værdier — alt andet giver standarden. */
export function valg<T extends string>(v: Felt, tilladte: Noegler, standard: T): T;
export function valg<T extends string>(v: Felt, tilladte: Noegler, standard?: null): T | null;
export function valg<T extends string>(v: Felt, tilladte: Noegler, standard: T | null = null): T | null {
  const s = tekst(v);
  if (s == null) return standard;
  const ok = (tilladte as readonly (string | { key: string })[]).some((t) => (typeof t === "string" ? t : t.key) === s);
  return ok ? (s as T) : standard;
}

/** Læser en formular med de samme regler som funktionerne ovenfor. */
export function formular(fd: FormData) {
  return {
    tekst: (navn: string) => tekst(fd.get(navn)),
    tal: (navn: string) => tal(fd.get(navn)),
    heltal: (navn: string) => heltal(fd.get(navn)),
    dato: (navn: string) => dato(fd.get(navn)),
    flueben: (navn: string) => flueben(fd.get(navn)),
    har: (navn: string) => fd.has(navn),
    valg: (navn: string, tilladte: Noegler, standard: string): string => valg(fd.get(navn), tilladte, standard),
    valgfrit: (navn: string, tilladte: Noegler): string | null => valg(fd.get(navn), tilladte, null),
    alle: (navn: string) => fd.getAll(navn).filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim()),
    fil: (navn: string) => {
      const v = fd.get(navn);
      return v instanceof File && v.size > 0 ? v : null;
    },
  };
}

export type Formular = ReturnType<typeof formular>;
