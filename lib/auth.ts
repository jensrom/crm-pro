import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { COOKIE, LEVETID_SEK, laesSessionKiks, pak } from "@/lib/sessionkiks";
import { kanLaese, kanSkrive, normaliserRolle, rettigheder, type Rettigheder, type Rolle } from "@/lib/roller";

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
  role: Rolle;
  /** Hvad brugeren må — se lib/roller.ts */
  ret: Rettigheder;
  /** admin eller superadmin */
  erAdmin: boolean;
  /** Kun superadmin har adgang til Indstillinger (katalog, brugere, database …) */
  erSuperAdmin: boolean;
};

/**
 * Den indloggede bruger. Slås op i databasen, så en deaktiveret bruger eller
 * en ændret rolle virker med det samme. Hentes én gang pr. forespørgsel
 * (React cache), selv om layout, side og handlinger hver især spørger.
 */
export const hentSession = cache(async (): Promise<Session | null> => {
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
    role: normaliserRolle(bruger.role),
    ret: rettigheder(bruger.role),
    erAdmin: ["admin", "superadmin"].includes(normaliserRolle(bruger.role)),
    erSuperAdmin: bruger.role === "superadmin",
  };
});

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
  if (!s.ret.indstillinger) redirect("/ingen-adgang");
  return s;
}

// ---------- Områder ----------

export type Omraade = "salg" | "teknik" | "kunder";

/** Kræver læseadgang til et område — ellers til "Ingen adgang". */
export async function kraevLaes(omr: Omraade): Promise<Session> {
  const s = await kraevBruger();
  if (!kanLaese(s.ret[omr])) redirect("/ingen-adgang");
  return s;
}

/** Kræver skriveadgang til et område. Bruges i alle server-actions. */
export async function kraevSkriv(omr: Omraade): Promise<Session> {
  const s = await kraevBruger();
  if (!kanSkrive(s.ret[omr])) redirect("/ingen-adgang");
  return s;
}

/** Arbejdstid: Tekniker og alle med skriveadgang til teknik. */
export async function kraevTid(): Promise<Session> {
  const s = await kraevBruger();
  if (!s.ret.tid) redirect("/ingen-adgang");
  return s;
}

/** Leads, salgsnotater: Sælger og alle med skriveadgang til salg. */
export async function kraevLeads(): Promise<Session> {
  const s = await kraevBruger();
  if (!s.ret.leads && !kanSkrive(s.ret.salg)) redirect("/ingen-adgang");
  return s;
}

/** Logbogen: alle der må skrive noget som helst på kunden. */
export async function kraevLogbog(): Promise<Session> {
  const s = await kraevBruger();
  const r = s.ret;
  if (!(kanSkrive(r.kunder) || kanSkrive(r.salg) || kanSkrive(r.teknik) || r.leads || r.tid)) redirect("/ingen-adgang");
  return s;
}
