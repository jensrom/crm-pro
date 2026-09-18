"use server";

import { db } from "@/lib/db";
import { hashPin, kraevAdmin, ryddSession, saetSession, tjekPin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

const PIN_MOENSTER = /^\d{4,8}$/;

export async function logInd(formData: FormData) {
  const initialer = txt(formData.get("initials"))?.toUpperCase();
  const pin = txt(formData.get("pin"));
  if (!initialer || !pin) redirect("/login?fejl=mangler");

  const bruger = await db.user.findUnique({ where: { initials: initialer } });
  // Samme svar uanset om det er initialerne eller PIN'en der er forkert.
  if (!bruger || !bruger.isActive || !tjekPin(pin, bruger.pinHash)) {
    redirect("/login?fejl=forkert");
  }

  await db.user.update({ where: { id: bruger.id }, data: { lastLoginAt: new Date() } });
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
      role: "admin",
      pinHash: hashPin(pin),
    },
  });
  await saetSession(bruger.id, bruger.initials);
  redirect("/dashboard");
}

// ---------- Administration ----------

export async function opretBruger(formData: FormData) {
  await kraevAdmin();
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
      title: txt(formData.get("title")),
      role: formData.get("role") === "admin" ? "admin" : "bruger",
      pinHash: hashPin(pin),
    },
  });
  revalidatePath("/indstillinger/brugere");
  redirect("/indstillinger/brugere?besked=oprettet");
}

export async function gemBruger(id: string, formData: FormData) {
  const mig = await kraevAdmin();
  const navn = txt(formData.get("name"));
  const nyRolle = formData.get("role") === "admin" ? "admin" : "bruger";
  const aktiv = formData.get("isActive") === "on";

  // En administrator må ikke fjerne sin egen adgang og låse alle ude.
  if (id === mig.id && (nyRolle !== "admin" || !aktiv)) {
    const andreAdmins = await db.user.count({ where: { role: "admin", isActive: true, NOT: { id } } });
    if (andreAdmins === 0) redirect("/indstillinger/brugere?fejl=sidste-admin");
  }

  await db.user.update({
    where: { id },
    data: {
      name: navn ?? "Uden navn",
      email: txt(formData.get("email")),
      phone: txt(formData.get("phone")),
      title: txt(formData.get("title")),
      role: nyRolle,
      isActive: aktiv,
    },
  });
  revalidatePath("/indstillinger/brugere");
  redirect("/indstillinger/brugere?besked=gemt");
}

export async function nulstilPin(id: string, formData: FormData) {
  await kraevAdmin();
  const pin = txt(formData.get("pin"));
  if (!pin || !PIN_MOENSTER.test(pin)) redirect("/indstillinger/brugere?fejl=pin");
  await db.user.update({ where: { id }, data: { pinHash: hashPin(pin) } });
  redirect("/indstillinger/brugere?besked=pin");
}

export async function sletBruger(id: string) {
  const mig = await kraevAdmin();
  if (id === mig.id) redirect("/indstillinger/brugere?fejl=sig-selv");
  const andreAdmins = await db.user.count({ where: { role: "admin", isActive: true, NOT: { id } } });
  if (andreAdmins === 0) redirect("/indstillinger/brugere?fejl=sidste-admin");
  await db.user.delete({ where: { id } });
  revalidatePath("/indstillinger/brugere");
  redirect("/indstillinger/brugere?besked=slettet");
}
