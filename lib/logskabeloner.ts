import "server-only";
import { db } from "@/lib/db";

/** Standardteksterne, der lægges ind første gang. Kan rettes og slettes under Indstillinger → Salg. */
const STANDARD = [
  "Ringet — intet svar",
  "Talt med kunden",
  "Mail sendt",
  "Afventer svar fra kunden",
  "Møde aftalt",
  "Tilbud sendt",
  "Eskaleret internt",
];

/** Hurtigteksterne til tilstandsloggen. Lægger standarderne ind første gang. */
export async function hentLogSkabeloner(kunAktive = true) {
  // Kun den forespørgsel der "vinder" flaget, lægger standarderne ind — så to samtidige sidevisninger ikke giver dubletter
  await db.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const vundet = await db.settings.updateMany({ where: { id: "singleton", logSkabelonerOprettet: false }, data: { logSkabelonerOprettet: true } });
  if (vundet.count === 1) {
    await db.logSkabelon.createMany({ data: STANDARD.map((tekst, i) => ({ tekst, sortOrder: i })) });
  }
  return db.logSkabelon.findMany({
    where: kunAktive ? { isActive: true } : {},
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
