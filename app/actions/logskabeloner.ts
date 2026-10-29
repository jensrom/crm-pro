"use server";

/** Indstillinger → Salg → Log skrivning: hurtigteksterne til tilstandsloggen. */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { kraevSuperAdmin } from "@/lib/auth";
import { formular } from "@/lib/formular";

function opfrisk() {
  revalidatePath("/indstillinger/salg");
  revalidatePath("/kunder", "layout");
}

export async function opretLogSkabelon(formData: FormData) {
  await kraevSuperAdmin();
  const tekst = formular(formData).tekst("tekst")?.slice(0, 120);
  if (!tekst) return;
  const sidste = await db.logSkabelon.aggregate({ _max: { sortOrder: true } });
  await db.logSkabelon.create({ data: { tekst, sortOrder: (sidste._max.sortOrder ?? -1) + 1 } });
  opfrisk();
}

export async function gemLogSkabelon(id: string, formData: FormData) {
  await kraevSuperAdmin();
  const f = formular(formData);
  const tekst = f.tekst("tekst")?.slice(0, 120);
  if (!tekst) return;
  await db.logSkabelon.update({
    where: { id },
    data: { tekst, sortOrder: f.heltal("sortOrder") ?? 0, isActive: f.flueben("isActive") },
  });
  opfrisk();
}

export async function sletLogSkabelon(id: string) {
  await kraevSuperAdmin();
  await db.logSkabelon.deleteMany({ where: { id } });
  opfrisk();
}

/** Flytter en tekst én plads op eller ned i rækkefølgen. */
export async function flytLogSkabelon(id: string, retning: -1 | 1) {
  await kraevSuperAdmin();
  const alle = await db.logSkabelon.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = alle.findIndex((a) => a.id === id);
  const j = i + retning;
  if (i < 0 || j < 0 || j >= alle.length) return;
  [alle[i], alle[j]] = [alle[j], alle[i]];
  await db.$transaction(alle.map((a, n) => db.logSkabelon.update({ where: { id: a.id }, data: { sortOrder: n } })));
  opfrisk();
}
