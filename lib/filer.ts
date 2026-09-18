import "server-only";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { rm, writeFile, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { dataMappe } from "@/lib/config";

/**
 * Filboksens filer ligger paa disk ved siden af databasen -- ikke i SQLite-
 * filen selv, ligesom crm-pro.db ikke ligger i CRM-Pro-data ved et tilfaelde.
 * I dev er det <projektmappe>/filer, i den portable udgave er det
 * <CRM-Pro-data>/filer -- begge dele styret af CRMPRO_DATA_DIR, se lib/config.ts.
 *
 * Kun stien (relativt til datamappen) gemmes i databasen, saa flytter man hele
 * datamappen (jf. PORTABEL.md), foelger filerne automatisk med.
 */

const FILER_UNDERMAPPE = "filer";

function filerRod(): string {
  return join(dataMappe(), FILER_UNDERMAPPE);
}

/** Absolut sti ud fra den relative sti der ligger gemt i Attachment.storedPath. */
export function absolutFilSti(storedPath: string): string {
  return isAbsolute(storedPath) ? storedPath : resolve(dataMappe(), storedPath);
}

/** Fjerner alt der kan bruges til at bryde ud af mappen eller genere filsystemet. */
function saniterFilnavn(navn: string): string {
  const basis = navn.replace(/[\/\\]/g, "_").trim();
  const kortet = basis.slice(-150); // lange navne (fx eksporterede moedereferater) skaeres paent af bagfra
  return kortet || "fil";
}

/**
 * Gemmer en uploadet fil paa disk under <datamappe>/filer/<companyId>/ og
 * returnerer det Attachment-modellen skal bruge. Filnavnet faar et kort
 * tilfaeldigt praefiks saa to uploads af "kontrakt.pdf" ikke kolliderer.
 */
export async function gemFilPaaDisk(
  companyId: string,
  file: File
): Promise<{ storedPath: string; filename: string; mimeType: string; sizeBytes: number }> {
  const mappe = join(filerRod(), companyId);
  if (!existsSync(mappe)) mkdirSync(mappe, { recursive: true });

  const filename = saniterFilnavn(file.name || "fil");
  const praefiks = randomBytes(4).toString("hex");
  const diskNavn = `${praefiks}-${filename}`;
  const absSti = join(mappe, diskNavn);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absSti, bytes);

  const storedPath = join(FILER_UNDERMAPPE, companyId, diskNavn);
  return {
    storedPath,
    filename,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: bytes.byteLength,
  };
}

/** Sletter filen fra disk. Fejler aldrig hoerbart -- en manglende fil skal ikke vaelte en DB-sletning. */
export async function sletFilFraDisk(storedPath: string): Promise<void> {
  try {
    await rm(absolutFilSti(storedPath), { force: true });
  } catch {
    // Filen var maaske allerede vaek (fx flyttet datamappe) -- ikke noget at goere ved.
  }
}

/** Laeser filens indhold til brug i download-routen. */
export async function laesFilFraDisk(storedPath: string): Promise<Buffer> {
  return readFile(absolutFilSti(storedPath));
}
