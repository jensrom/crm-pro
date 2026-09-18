"use server";

import { redirect } from "next/navigation";
import { kraevAdmin } from "@/lib/auth";
import { gemOpdateringsSti } from "@/lib/config";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/**
 * Sætter (eller rydder) stien til version.json for opdateringstjekket.
 *
 * En tom sti er en gyldig værdi — det er sådan tjekket slås fra igen, uden
 * at man skal grave i konfigurationsfilen manuelt.
 */
export async function gemOpdateringsplacering(formData: FormData) {
  await kraevAdmin();

  const nySti = txt(formData.get("updateManifestPath"));
  gemOpdateringsSti(nySti ?? "");
  redirect(`/indstillinger/opdatering?besked=${nySti ? "gemt" : "fjernet"}`);
}
