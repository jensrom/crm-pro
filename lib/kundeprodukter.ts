import { gaeldendeMaanedspris } from "@/lib/pricing";

/** Et produkt (fx Idus eller Fiix) kunden har licenser under. */
export type KundeProdukt = {
  navn: string;
  ikon: string | null;
  farve: string | null;
  /** Licenser i alt under produktet */
  licenser: number;
  /** "3 × Idus Online Professional" — vises ved hover */
  linjer: string[];
  udenPris: boolean;
};

type Linje = {
  productId: string;
  seats: number;
  unitPriceMonth: number | null;
  product: {
    name: string;
    icon: string | null;
    color: string | null;
    licenseModel: string;
    pricePerUserMonth: number | null;
    family: { id: string; name: string; sortOrder: number } | null;
  };
};

/** Samler kundens licenslinjer under deres produkt (katalogets rækkefølge). */
export function grupperProdukter(linjer: Linje[]): KundeProdukt[] {
  const m = new Map<string, KundeProdukt & { sortering: number }>();
  for (const l of linjer) {
    const fam = l.product.family;
    const noegle = fam?.id ?? `licens-${l.productId}`;
    const p = m.get(noegle) ?? {
      navn: fam?.name ?? l.product.name,
      ikon: l.product.icon,
      farve: l.product.color,
      licenser: 0,
      linjer: [],
      udenPris: false,
      sortering: fam?.sortOrder ?? 999,
    };
    p.licenser += l.seats;
    p.linjer.push(`${l.seats} × ${l.product.name}`);
    if (gaeldendeMaanedspris(l.unitPriceMonth, l.product) == null) p.udenPris = true;
    m.set(noegle, p);
  }
  return [...m.values()]
    .sort((a, b) => a.sortering - b.sortering || a.navn.localeCompare(b.navn, "da-DK"))
    .map(({ sortering: _s, ...p }) => p);
}
