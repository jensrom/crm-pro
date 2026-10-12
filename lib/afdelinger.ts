import "server-only";
import { db } from "@/lib/db";

/**
 * Faste afdelinger. Findes en afdeling ikke, oprettes den — findes den, udfyldes
 * kun de felter der står tomme, så intet man selv har rettet bliver overskrevet.
 * Tomme felter (CVR, bank, mail …) hentes fra de fælles afsenderoplysninger.
 */
const AFDELINGER = [
  {
    name: "Glostrup",
    department: "Novotek A/S, Glostrup",
    companyName: "Novotek A/S",
    address: "Naverland 2",
    zipCity: "2600 Glostrup",
    country: "Danmark",
    sortOrder: 20,
  },
];

export async function sikrAfdelinger() {
  for (const a of AFDELINGER) {
    const fundet = await db.senderProfile.findFirst({ where: { name: { equals: a.name, mode: "insensitive" } } });
    if (!fundet) {
      await db.senderProfile.create({ data: a });
      continue;
    }
    const mangler: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(a)) {
      if (k === "name" || k === "sortOrder") continue;
      if ((fundet as any)[k] == null || (fundet as any)[k] === "") mangler[k] = v;
    }
    if (Object.keys(mangler).length) await db.senderProfile.update({ where: { id: fundet.id }, data: mangler });
  }
}
