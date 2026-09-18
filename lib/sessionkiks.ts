import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { laesKonfig } from "@/lib/config";

/**
 * Selve login-cookien, adskilt fra resten af auth-laget.
 *
 * Grunden til at den bor for sig: både auth og databaselaget skal kunne læse
 * hvem der sidder ved tasterne, og databaselaget må ikke slå brugeren op i
 * databasen for at finde ud af det. Et opslag midt i en skrivning ville tage
 * en ekstra forbindelse til den samme SQLite-fil — og det er lige præcis den
 * slags der låser sig fast over et netværksdrev.
 *
 * Derfor bærer cookien selv initialerne. Den er HMAC-signeret, så den kan ikke
 * ændres udefra, og initialerne bruges udelukkende til at skrive "sidst gemt
 * af" — aldrig til at afgøre hvad nogen må.
 */

export const COOKIE = "crmpro_session";
export const LEVETID_SEK = 60 * 60 * 12; // en arbejdsdag

export type SessionKiks = { id: string; initials: string | null };

function signer(data: string) {
  return createHmac("sha256", laesKonfig().authSecret).update(data).digest("hex");
}

export function pak(brugerId: string, initialer: string) {
  const udloeb = Math.floor(Date.now() / 1000) + LEVETID_SEK;
  const krop = `${brugerId}~${initialer}`;
  const data = `${krop}.${udloeb}`;
  return `${data}.${signer(data)}`;
}

export function pakUd(vaerdi: string): SessionKiks | null {
  const dele = vaerdi.split(".");
  if (dele.length !== 3) return null;
  const [krop, udloeb, signatur] = dele;
  const forventet = signer(`${krop}.${udloeb}`);
  if (signatur.length !== forventet.length) return null;
  if (!timingSafeEqual(Buffer.from(signatur), Buffer.from(forventet))) return null;
  if (Number(udloeb) * 1000 < Date.now()) return null;

  // Ældre cookies bærer kun bruger-id. De virker stadig, bare uden initialer.
  const [id, initialer] = krop.split("~");
  if (!id) return null;
  return { id, initials: initialer || null };
}

/** Læser og efterprøver cookien. Uden for en forespørgsel giver den null. */
export async function laesSessionKiks(): Promise<SessionKiks | null> {
  try {
    const c = await cookies();
    const raa = c.get(COOKIE)?.value;
    return raa ? pakUd(raa) : null;
  } catch {
    return null;
  }
}
