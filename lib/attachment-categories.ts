/**
 * Filboks-kategorier — bruges i kundens filliste til at gruppere kontrakter,
 * planer, mødereferater m.m. i stedet for én flad liste.
 *
 * "email" er forberedt til fremtidig indgående mail (fx en dedikeret
 * mailadresse pr. kunde), men kan også bruges når man manuelt gemmer en
 * PDF/eksport af en mailtråd.
 */

export type Filkategori = "kontrakt" | "ordre" | "licensbevis" | "plan" | "moedereferat" | "email" | "andet";

export const FILKATEGORIER: Filkategori[] = ["kontrakt", "ordre", "licensbevis", "plan", "moedereferat", "email", "andet"];

export const FILKATEGORI_LABEL: Record<Filkategori, string> = {
  kontrakt: "Kontrakter",
  ordre: "Ordrebekræftelser",
  licensbevis: "Licensbeviser",
  plan: "Planer",
  moedereferat: "Mødereferater",
  email: "E-mails",
  andet: "Andet",
};

/** Ental-form — bruges i upload-vælgeren ("Gemmes som: Kontrakt") */
export const FILKATEGORI_LABEL_ENTAL: Record<Filkategori, string> = {
  kontrakt: "Kontrakt",
  ordre: "Ordrebekræftelse",
  licensbevis: "Licensbevis",
  plan: "Plan",
  moedereferat: "Mødereferat",
  email: "E-mail",
  andet: "Andet",
};

export function normaliserKategori(value: FormDataEntryValue | string | null | undefined): Filkategori {
  if (typeof value === "string" && (FILKATEGORIER as string[]).includes(value)) {
    return value as Filkategori;
  }
  return "andet";
}
