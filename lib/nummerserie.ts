import "server-only";
import { Prisma } from "@prisma/client";

/**
 * Fortløbende nummerserier (TIL-/ORD-numre, SAG-, KK- og SUB-numre).
 *
 * Næste nummer findes som "højeste + 1". Opretter to brugere noget i samme
 * øjeblik, kan de få samme nummer — databasens unikke indeks afviser den
 * ene, og så prøver vi igen med et frisk nummer. Det er enklere og mere
 * robust end en separat tællertabel, og serien får aldrig huller af fejl.
 */
export async function medLoebenummer<T>(naeste: () => Promise<number>, opret: (nummer: number) => Promise<T>, forsoeg = 5): Promise<T> {
  for (let i = 1; ; i++) {
    const nummer = await naeste();
    try {
      return await opret(nummer);
    } catch (e) {
      const kollision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!kollision || i >= forsoeg) throw e;
    }
  }
}

/** Fejlkode for "findes allerede" (unikt indeks). */
export const erDublet = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
/** Fejlkode for "posten findes ikke" (fx slettet i en anden fane). */
export const findesIkke = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
