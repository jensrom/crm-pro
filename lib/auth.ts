import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { COOKIE, LEVETID_SEK, laesSessionKiks, pak } from "@/lib/sessionkiks";

// ---------- PIN ----------

/** scrypt med eget salt. PIN'en findes aldrig i klartekst i databasen. */
export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function tjekPin(pin: string, gemt: string) {
  const [salt, hash] = gemt.split(":");
  if (!salt || !hash) return false;
  const proeve = scryptSync(pin, salt, 64);
  const facit = Buffer.from(hash, "hex");
  return proeve.length === facit.length && timingSafeEqual(proeve, facit);
}

// ---------- Session ----------

export async function saetSession(brugerId: string, initialer: string) {
  const c = await cookies();
  c.set(COOKIE, pak(brugerId, initialer), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LEVETID_SEK,
  });
}

export async function ryddSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

// ---------- Opslag ----------

export type Session = {
  id: string;
  initials: string;
  name: string;
  role: string;
  /** admin eller superadmin */
  erAdmin: boolean;
  /** Kun superadmin har adgang til Indstillinger (katalog, brugere, database …) */
  erSuperAdmin: boolean;
};

export async function hentSession(): Promise<Session | null> {
  const kiks = await laesSessionKiks();
  if (!kiks) return null;

  const bruger = await db.user.findUnique({
    where: { id: kiks.id },
    select: { id: true, initials: true, name: true, role: true, isActive: true },
  });
  if (!bruger || !bruger.isActive) return null;

  return {
    id: bruger.id,
    initials: bruger.initials,
    name: bruger.name,
    role: bruger.role,
    erAdmin: bruger.role === "admin" || bruger.role === "superadmin",
    erSuperAdmin: bruger.role === "superadmin",
  };
}

export async function antalBrugere() {
  return db.user.count();
}

/** Kræver en gyldig session. Sender til login eller førstegangsopsætning. */
export async function kraevBruger(): Promise<Session> {
  const s = await hentSession();
  if (s) return s;
  if ((await antalBrugere()) === 0) redirect("/opsaetning");
  redirect("/login");
}

/** Kræver administrator (admin eller superadmin). */
export async function kraevAdmin(): Promise<Session> {
  const s = await kraevBruger();
  if (!s.erAdmin) redirect("/ingen-adgang");
  return s;
}

/** Kræver superadministrator. Alt under Indstillinger går igennem her. */
export async function kraevSuperAdmin(): Promise<Session> {
  const s = await kraevBruger();
  if (!s.erSuperAdmin) redirect("/ingen-adgang");
  return s;
}
