import "server-only";
import { db } from "@/lib/db";

/** Kundenummeret som det vises: K-00001. */
export const kundeNr = (n: number | null | undefined) => (n == null ? "K-?????" : `K-${String(n).padStart(5, "0")}`);

/** "Firma · Afdeling" — så kunder med samme navn kan skelnes. */
export const kundeNavn = (k: { name: string; department?: string | null }) => (k.department ? `${k.name} · ${k.department}` : k.name);

export async function naesteKundenummer() {
  const m = await db.company.aggregate({ _max: { customerNumber: true } });
  return (m._max.customerNumber ?? 0) + 1;
}

/** Giver kunder uden kundenummer et, ældste først. Kan kaldes igen og igen. */
export async function sikrKundenumre() {
  const uden = await db.company.findMany({ where: { customerNumber: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  for (const k of uden) {
    try {
      await db.company.update({ where: { id: k.id }, data: { customerNumber: await naesteKundenummer() } });
    } catch {
      // To samtidige sidevisninger kan nå at tage samme nummer — prøves igen næste gang
    }
  }
  return uden.length;
}
