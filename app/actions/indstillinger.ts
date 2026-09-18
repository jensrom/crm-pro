"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/** Et logo skal kunne ligge i databasen uden at gøre den tung. */
const MAKS_LOGO_BYTES = 400_000;
const TILLADTE = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"];

function opfrisk() {
  revalidatePath("/", "layout");
  revalidatePath("/indstillinger/whitelabel");
}

export async function gemWhitelabel(formData: FormData) {
  const data: {
    brandSubtitle: string | null;
    brandMarkText: string | null;
    brandLogo?: string | null;
  } = {
    brandSubtitle: txt(formData.get("brandSubtitle")),
    brandMarkText: txt(formData.get("brandMarkText"))?.slice(0, 3) ?? null,
  };

  if (formData.get("fjernLogo") === "on") {
    data.brandLogo = null;
  } else {
    const fil = formData.get("logo");
    if (fil instanceof File && fil.size > 0) {
      if (!TILLADTE.includes(fil.type)) {
        redirect("/indstillinger/whitelabel?fejl=filtype");
      }
      if (fil.size > MAKS_LOGO_BYTES) {
        redirect("/indstillinger/whitelabel?fejl=stoerrelse");
      }
      const base64 = Buffer.from(await fil.arrayBuffer()).toString("base64");
      data.brandLogo = `data:${fil.type};base64,${base64}`;
    }
  }

  await db.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  opfrisk();
  redirect("/indstillinger/whitelabel?besked=gemt");
}

export async function gemDatagrundlag(formData: FormData) {
  const note = txt(formData.get("dataSourceNote"));
  await db.settings.upsert({
    where: { id: "singleton" },
    update: { dataSourceNote: note },
    create: { id: "singleton", dataSourceNote: note },
  });
  revalidatePath("/dashboard");
  revalidatePath("/indstillinger/whitelabel");
  redirect("/indstillinger/whitelabel?besked=note");
}
