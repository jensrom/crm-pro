import "server-only";
import { db } from "@/lib/db";

/**
 * Filboksens filer ligger i databasen (Attachment.data). Vercel har ingen
 * vedvarende disk, og en request til en Vercel-funktion må højst være 4,5 MB —
 * derfor grænsen herunder.
 */
export const MAKS_FILSTOERRELSE = 4 * 1024 * 1024;

/** Fjerner tegn der ikke hører hjemme i et filnavn. */
export function saniterFilnavn(navn: string): string {
  const basis = navn.replace(/[\/\\]/g, "_").trim();
  return basis.slice(-150) || "fil";
}

/**
 * Gemmer en genereret fil (fx et licensbevis eller en ordrebekræftelse som PDF)
 * i kundens filboks og opretter posten. Returnerer filboks-postens id.
 */
export async function gemDokumentIFilboks(
  companyId: string,
  filnavn: string,
  bytes: Uint8Array,
  category: string,
  uploadedBy: string | null
): Promise<string> {
  const att = await db.attachment.create({
    data: {
      companyId,
      filename: saniterFilnavn(filnavn),
      category,
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      data: Buffer.from(bytes),
      uploadedBy,
    },
    select: { id: true },
  });
  return att.id;
}
