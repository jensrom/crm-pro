/**
 * Pakker: abonnementerne i én produktfamilie er pakker af samme produkt
 * (fx Idus Online Basic / Professional / Enterprise). En kunde ejer højst
 * én pakke pr. produkt; tilkøb sker altid på den ejede pakke, og et skift
 * til en højere pakke sker som en opgradering af aftalen.
 *
 * Evige licenser, ydelser og licenser uden produkt er ikke pakker og kan
 * altid vælges.
 */

type ProduktInfo = { id: string; familyId: string | null; licenseModel: string; pricePerUserMonth?: number | null; sortOrder?: number };
type EjetLinje = { productId: string; isActive?: boolean; product: { familyId: string | null; licenseModel: string } };

export const erPakke = (p: { familyId: string | null; licenseModel: string }) => p.licenseModel === "sub" && !!p.familyId;

/** Kundens ejede pakke pr. produktfamilie (familyId → productId). */
export function ejedePakker(linjer: EjetLinje[]) {
  const m = new Map<string, string>();
  for (const l of linjer) {
    if (l.isActive === false || !erPakke(l.product)) continue;
    if (!m.has(l.product.familyId!)) m.set(l.product.familyId!, l.productId);
  }
  return m;
}

/** Må kunden få p som ny licens / tilkøb? Nej, hvis kunden ejer en anden pakke af samme produkt. */
export function maaVaelges(p: ProduktInfo, ejede: Map<string, string>) {
  if (!erPakke(p)) return true;
  const ejet = ejede.get(p.familyId!);
  return !ejet || ejet === p.id;
}

/** Filtrerer katalog-grupper, så kun tilladte licenser står tilbage (tomme grupper fjernes). */
export function tilladteGrupper<G extends { licenser: ProduktInfo[] }>(grupper: G[], ejede: Map<string, string>): G[] {
  return grupper
    .map((g) => ({ ...g, licenser: g.licenser.filter((p) => maaVaelges(p, ejede)) }) as G)
    .filter((g) => g.licenser.length > 0);
}

/** Pakkens niveau: listepris, ellers katalogets rækkefølge. */
const niveau = (p: ProduktInfo) => [p.pricePerUserMonth ?? Number.POSITIVE_INFINITY, p.sortOrder ?? 0] as const;

/** De højere pakker i samme produkt, laveste først. Tom = pakken er allerede den højeste. */
export function hoejerePakker<P extends ProduktInfo>(nuvaerende: ProduktInfo, katalog: P[]): P[] {
  if (!erPakke(nuvaerende)) return [];
  const [pn, sn] = niveau(nuvaerende);
  return katalog
    .filter((p) => p.id !== nuvaerende.id && p.familyId === nuvaerende.familyId && p.licenseModel === "sub")
    .filter((p) => {
      const [pp, sp] = niveau(p);
      return pp > pn || (pp === pn && sp > sn);
    })
    .sort((a, b) => {
      const [pa, sa] = niveau(a);
      const [pb, sb] = niveau(b);
      return pa - pb || sa - sb;
    });
}

/** Nøglen til "samme produkt" på en SUB-nøgle: familien, ellers selve licensen. */
export const produktNoegle = (p: { id: string; familyId: string | null }) => p.familyId ?? `licens:${p.id}`;
