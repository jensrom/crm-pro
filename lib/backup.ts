import "server-only";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { databaseSti } from "@/lib/config";

/**
 * Sikkerhedskopier af databasen.
 *
 * De ligger i en mappe ved siden af selve databasefilen. Flytter databasen ud
 * på et fællesdrev, følger backupmappen med — så ser I den samme liste, og
 * kopierne ligger samme sted som det de er kopier af.
 */

const PRAEFIKS = "crm-pro-";
const ENDELSE = ".db";

export function backupMappe() {
  return join(dirname(databaseSti()), "backup");
}

export type Backup = {
  filnavn: string;
  sti: string;
  tid: Date;
  bytes: number;
  /** Initialer på den der trykkede, hvis filnavnet bærer dem. */
  af: string | null;
  /** Sat automatisk lige før en gendannelse, ikke af et menneske. */
  automatisk: boolean;
};

function toCifre(n: number) {
  return String(n).padStart(2, "0");
}

/** crm-pro-2026-08-28-1432-JPR.db */
function nytFilnavn(initialer: string | null, markoer?: string) {
  const d = new Date();
  const stempel = [
    d.getFullYear(),
    toCifre(d.getMonth() + 1),
    toCifre(d.getDate()),
  ].join("-") + "-" + toCifre(d.getHours()) + toCifre(d.getMinutes()) + toCifre(d.getSeconds());
  const hale = [markoer, initialer].filter(Boolean).join("-");
  return `${PRAEFIKS}${stempel}${hale ? `-${hale}` : ""}${ENDELSE}`;
}

function laesAf(filnavn: string) {
  // …-1432-JPR.db  →  JPR
  const m = filnavn.replace(ENDELSE, "").match(/-([A-ZÆØÅ]{1,8})$/);
  return m ? m[1] : null;
}

export function listBackups(): Backup[] {
  const mappe = backupMappe();
  if (!existsSync(mappe)) return [];
  return readdirSync(mappe)
    .filter((f) => f.startsWith(PRAEFIKS) && f.endsWith(ENDELSE))
    .map((filnavn) => {
      const sti = join(mappe, filnavn);
      const s = statSync(sti);
      return {
        filnavn,
        sti,
        tid: s.mtime,
        bytes: s.size,
        af: laesAf(filnavn),
        automatisk: filnavn.includes("-foer-gendannelse"),
      };
    })
    .sort((a, b) => b.tid.getTime() - a.tid.getTime());
}

/** Kun et rent filnavn fra backupmappen må bruges — aldrig en sti udefra. */
export function findBackup(filnavn: string): Backup | null {
  const rent = basename(filnavn);
  return listBackups().find((b) => b.filnavn === rent) ?? null;
}

/**
 * Laver en kopi med `VACUUM INTO`.
 *
 * Det er SQLites egen måde at skrive en hel, sammenhængende kopi ud på, mens
 * databasen er i brug. En almindelig filkopi kan ramme midt i en skrivning og
 * give en kopi der mangler noget — det er præcis den fejl vi vil undgå.
 */
export async function lavBackup(
  db: { $executeRawUnsafe: (sql: string) => Promise<unknown> },
  initialer: string | null,
  markoer?: string
): Promise<Backup> {
  const mappe = backupMappe();
  mkdirSync(mappe, { recursive: true });

  // VACUUM INTO nægter at skrive oven i en fil der findes — og det skal vi
  // heller ikke. To backups i samme sekund får hver sit navn.
  let filnavn = nytFilnavn(initialer, markoer);
  let maal = join(mappe, filnavn);
  for (let n = 2; existsSync(maal); n++) {
    filnavn = nytFilnavn(initialer, markoer).replace(ENDELSE, `-${n}${ENDELSE}`);
    maal = join(mappe, filnavn);
  }

  try {
    await db.$executeRawUnsafe(`VACUUM INTO '${maal.replace(/'/g, "''")}'`);
  } catch {
    // Ældre SQLite eller en fil der ikke vil vaskes: tag en almindelig kopi.
    copyFileSync(databaseSti(), maal);
  }

  const s = statSync(maal);
  return { filnavn, sti: maal, tid: s.mtime, bytes: s.size, af: initialer, automatisk: !!markoer };
}

/** Sidefiler SQLite kan efterlade. De skal væk når databasen skiftes ud. */
function ryddSidefiler(dbSti: string) {
  for (const endelse of ["-journal", "-wal", "-shm"]) {
    const f = dbSti + endelse;
    if (existsSync(f)) {
      try {
        rmSync(f);
      } catch {
        /* låst af en anden — gendannelsen fejler så alligevel synligt */
      }
    }
  }
}

/** Lægger en kopi tilbage oven i den nuværende database. */
export function gendan(backupSti: string) {
  const maal = databaseSti();
  ryddSidefiler(maal);
  copyFileSync(backupSti, maal);
}

export function sletBackup(sti: string) {
  rmSync(sti);
}
