import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Selve login-cookien, adskilt fra resten af auth-laget.
 *
 * Grunden til at den bor for sig: både auth og databaselaget skal kunne læse
 * hvem der sidder ved tasterne, og databaselaget må ikke slå brugeren op i
 * databasen for at finde ud af det. Et opslag midt i en skrivning ville tage
 * en ekstra databaseforespørgsel for hver eneste skrivning.
 *
 * Derfor bærer cookien selv initialerne. Den er HMAC-signeret, så den kan ikke
 * ændres udefra, og initialerne bruges udelukkende til at skrive "sidst gemt
 * af" — aldrig til at afgøre hvad nogen må.
 */

export const COOKIE = "crmpro_session";
export const LEVETID_SEK = 60 * 60 * 12; // en arbejdsdag

export type SessionKiks = { id: string; initials: string | null };

/**
 * Nøglen der signerer login-cookien. Sættes som AUTH_SECRET i Vercel (mindst
 * 32 tegn). Uden den kan ingen logge ind i produktion — hellere det end en
 * forudsigelig nøgle.
 */
export function authSecret() {
  const s = process.env.AUTH_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-hemmelighed-kun-til-lokal-udvikling-0000";
  throw new Error("AUTH_SECRET mangler eller er kortere end 32 tegn");
}

function signer(data: string) {
  return createHmac("sha256", authSecret()).update(data).digest("hex");
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
