import { db } from "@/lib/db";
import { gaeldendeMaanedspris, samletAarsvaerdi, linjerUdenPris } from "@/lib/pricing";

export type Indstillinger = {
  dataSourceNote: string | null;
  brandSubtitle: string | null;
  brandMarkText: string | null;
  brandLogo: string | null;
  updatedBy: string | null;
  updatedAt: Date | null;
};

/**
 * Læser rækken — og opretter den kun hvis den mangler.
 *
 * Bevidst ikke en upsert: en upsert ville skrive i databasen ved hver eneste
 * sidevisning. Det ville sætte "sidst gemt" til den der kigger, og på et
 * netværksdrev ville det være en skrivning hvert femte sekund uden grund.
 */
export async function hentIndstillinger(): Promise<Indstillinger> {
  const s =
    (await db.settings.findUnique({ where: { id: "singleton" } })) ??
    (await db.settings.create({ data: { id: "singleton" } }));
  return {
    dataSourceNote: s.dataSourceNote,
    brandSubtitle: s.brandSubtitle,
    brandMarkText: s.brandMarkText,
    brandLogo: s.brandLogo,
    updatedBy: s.updatedBy,
    updatedAt: s.updatedAt,
  };
}

export type KundeNoegletal = {
  /** Tildelte licenser — grundlaget for alt budget. */
  seats: number;
  /** Licenser i brug ifølge portalen. */
  aktive: number;
  udnyttelse: number | null;
  ledige: number;
  fuld: boolean;
  /** Årlig licensværdi = tildelte licenser × aftalt månedspris × 12. */
  aarsvaerdi: number;
  /** Antal pakkelinjer uden pris, så en ufuldstændig sum kan markeres. */
  udenPris: number;
};

type Linje = {
  seats: number;
  activeSeats: number;
  unitPriceMonth: number | null;
  product: { pricePerUserMonth: number | null } | null;
};

export function noegletal(linjer: Linje[]): KundeNoegletal {
  const seats = linjer.reduce((s, l) => s + l.seats, 0);
  const aktive = linjer.reduce((s, l) => s + l.activeSeats, 0);
  return {
    seats,
    aktive,
    udnyttelse: seats > 0 ? aktive / seats : null,
    ledige: seats - aktive,
    fuld: seats > 0 && aktive >= seats,
    aarsvaerdi: samletAarsvaerdi(linjer),
    udenPris: linjerUdenPris(linjer),
  };
}

export { gaeldendeMaanedspris };

export async function hentKunderMedNoegletal() {
  const [indstillinger, kunder] = await Promise.all([
    hentIndstillinger(),
    db.company.findMany({
      include: {
        customerProducts: { where: { isActive: true }, include: { product: true } },
        contacts: { where: { isActive: true } },
        deals: true,
      },
    }),
  ]);

  const rows = kunder.map((k) => ({ ...k, n: noegletal(k.customerProducts) }));
  rows.sort((a, b) => a.name.localeCompare(b.name, "da-DK"));
  return { indstillinger, kunder: rows };
}

export type KundeRaekke = Awaited<ReturnType<typeof hentKunderMedNoegletal>>["kunder"][number];
