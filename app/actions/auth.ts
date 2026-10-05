"use server";

import { db } from "@/lib/db";
import { hashPin, kraevSuperAdmin, ryddSession, saetSession, tjekPin } from "@/lib/auth";
import { tolkRolle } from "@/lib/roller";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

const PIN_MOENSTER = /^\d{4,8}$/;

/** Efter så mange forkerte PIN-forsøg i træk spærres brugeren et stykke tid. */
const MAKS_FORSOEG = 5;
const SPAERRING_MIN = 15;

/**
 * Førstegangsopsætningen er åben, så længe der ingen brugere er. På internettet
 * kræver den derfor koden fra miljøvariablen OPSAETNINGSKODE — uden den er
 * opsætningen lukket i produktion.
 */
function opsaetningskodeOk(kode: string | null) {
  if (process.env.NODE_ENV !== "production") return true;
  const rigtig = process.env.OPSAETNINGSKODE?.trim();
  return !!rigtig && rigtig.length >= 8 && kode === rigtig;
}

export async function logInd(formData: FormData) {
  const initialer = txt(formData.get("initials"))?.toUpperCase();
  const pin = txt(formData.get("pin"));
  if (!initialer || !pin) redirect("/login?fejl=mangler");

  const bruger = await db.user.findUnique({ where: { initials: initialer } });
  if (bruger?.lockedUntil && bruger.lockedUntil > new Date()) redirect("/login?fejl=spaerret");

  // Samme svar uanset om det er initialerne eller PIN'en der er forkert.
  if (!bruger || !bruger.isActive || !tjekPin(pin, bruger.pinHash)) {
    if (bruger) {
      const forsoeg = bruger.failedLogins + 1;
      await db.user.update({
        where: { id: bruger.id },
        data: {
          failedLogins: forsoeg >= MAKS_FORSOEG ? 0 : forsoeg,
          ...(forsoeg >= MAKS_FORSOEG ? { lockedUntil: new Date(Date.now() + SPAERRING_MIN * 60_000) } : {}),
        },
      });
    }
    redirect("/login?fejl=forkert");
  }

  await db.user.update({ where: { id: bruger.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  await saetSession(bruger.id, bruger.initials);
  redirect("/dashboard");
}

export async function logUd() {
  await ryddSession();
  redirect("/login");
}

/** Første bruger oprettes uden login — men kun så længe der slet ingen brugere er. */
export async function opretFoersteAdmin(formData: FormData) {
  if ((await db.user.count()) > 0) redirect("/login");
  if (!opsaetningskodeOk(txt(formData.get("kode")))) redirect("/opsaetning?fejl=kode");

  const initialer = txt(formData.get("initials"))?.toUpperCase();
  const navn = txt(formData.get("name"));
  const pin = txt(formData.get("pin"));
  if (!initialer || !navn || !pin) redirect("/opsaetning?fejl=mangler");
  if (!PIN_MOENSTER.test(pin)) redirect("/opsaetning?fejl=pin");

  const bruger = await db.user.create({
    data: {
      initials: initialer,
      name: navn,
      email: txt(formData.get("email")),
      // Den første bruger skal kunne komme ind i Indstillinger.
      role: "superadmin",
      pinHash: hashPin(pin),
    },
  });
  await saetSession(bruger.id, bruger.initials);
  redirect("/dashboard");
}

// ---------- Administration ----------

export async function opretBruger(formData: FormData) {
  await kraevSuperAdmin();
  const initialer = txt(formData.get("initials"))?.toUpperCase();
  const navn = txt(formData.get("name"));
  const pin = txt(formData.get("pin"));
  if (!initialer || !navn || !pin) redirect("/indstillinger/brugere?fejl=mangler");
  if (!PIN_MOENSTER.test(pin)) redirect("/indstillinger/brugere?fejl=pin");

  const findes = await db.user.findUnique({ where: { initials: initialer } });
  if (findes) redirect("/indstillinger/brugere?fejl=initialer");

  await db.user.create({
    data: {
      initials: initialer,
      name: navn,
      email: txt(formData.get("email")),
      phone: txt(formData.get("phone")),
      mobile: txt(formData.get("mobile")),
      title: txt(formData.get("title")),
      senderProfileId: txt(formData.get("senderProfileId")),
      role: tolkRolle(formData.get("role")),
      pinHash: hashPin(pin),
    },
  });
  revalidatePath("/indstillinger/brugere");
  redirect("/indstillinger/brugere?besked=oprettet");
}

export async function gemBruger(id: string, formData: FormData) {
  await kraevSuperAdmin();
  const navn = txt(formData.get("name"));
  const nyRolle = tolkRolle(formData.get("role"));
  const aktiv = formData.get("isActive") === "on";

  // Der skal altid være mindst én aktiv superadministrator — ellers kan
  // ingen komme ind i Indstillinger igen.
  if (nyRolle !== "superadmin" || !aktiv) {
    const andre = await db.user.count({ where: { role: "superadmin", isActive: true, NOT: { id } } });
    if (andre === 0) redirect("/indstillinger/brugere?fejl=sidste-admin");
  }

  await db.user.update({
    where: { id },
    data: {
      name: navn ?? "Uden navn",
      email: txt(formData.get("email")),
      phone: txt(formData.get("phone")),
      mobile: txt(formData.get("mobile")),
      title: txt(formData.get("title")),
      senderProfileId: txt(formData.get("senderProfileId")),
      role: nyRolle,
      isActive: aktiv,
    },
  });
  revalidatePath("/indstillinger/brugere");
  redirect("/indstillinger/brugere?besked=gemt");
}

export async function nulstilPin(id: string, formData: FormData) {
  await kraevSuperAdmin();
  const pin = txt(formData.get("pin"));
  if (!pin || !PIN_MOENSTER.test(pin)) redirect("/indstillinger/brugere?fejl=pin");
  await db.user.update({ where: { id }, data: { pinHash: hashPin(pin) } });
  redirect("/indstillinger/brugere?besked=pin");
}

export async function sletBruger(id: string) {
  const mig = await kraevSuperAdmin();
  if (id === mig.id) redirect("/indstillinger/brugere?fejl=sig-selv");
  const andre = await db.user.count({ where: { role: "superadmin", isActive: true, NOT: { id } } });
  if (andre === 0) redirect("/indstillinger/brugere?fejl=sidste-admin");
  await db.user.delete({ where: { id } });
  revalidatePath("/indstillinger/brugere");
  redirect("/indstillinger/brugere?besked=slettet");
}
