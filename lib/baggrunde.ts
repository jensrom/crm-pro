/**
 * Appens baggrund: et meget svagt mønster under glasset (Indstillinger → Udseende).
 * Delt mellem layoutet (server) og indstillingssiden (klient) — ingen serverkode her.
 */

export const BAGGRUNDE = [
  { id: "ingen", navn: "Ingen", note: "Ren flade" },
  { id: "aurora", navn: "Isblå aurora", note: "Bløde nordlys-toner" },
  { id: "isflager", navn: "Isflager", note: "Facetter som is" },
  { id: "dybhav", navn: "Dybt hav", note: "Mørkere og tungere" },
] as const;

export type BaggrundId = (typeof BAGGRUNDE)[number]["id"] | "billede";

export const STANDARD_BAGGRUND: BaggrundId = "aurora";
export const STANDARD_STYRKE = 32;
export const MAKS_STYRKE = 60;

export const MOENSTRE: Record<Exclude<BaggrundId, "billede">, string> = {
  ingen: "none",
  aurora:
    "radial-gradient(42% 52% at 12% 18%, #6ab8ff 0%, rgba(106,184,255,0) 70%), radial-gradient(38% 48% at 88% 12%, #a99bff 0%, rgba(169,155,255,0) 70%), radial-gradient(46% 56% at 72% 88%, #62d8c8 0%, rgba(98,216,200,0) 70%), radial-gradient(40% 44% at 22% 92%, #8ec2ff 0%, rgba(142,194,255,0) 70%)",
  isflager:
    "linear-gradient(118deg, rgba(120,180,235,.9) 0 16%, rgba(120,180,235,0) 16% 38%, rgba(170,210,245,.9) 38% 52%, rgba(170,210,245,0) 52%), linear-gradient(32deg, rgba(150,195,240,0) 0 28%, rgba(110,165,225,.85) 28% 44%, rgba(110,165,225,0) 44% 68%, rgba(185,220,248,.9) 68%), linear-gradient(165deg, rgba(205,228,250,0) 0 58%, rgba(140,190,238,.8) 58% 74%, rgba(205,228,250,0) 74%)",
  dybhav:
    "radial-gradient(60% 50% at 20% 10%, #4f8fd6 0%, rgba(79,143,214,0) 70%), radial-gradient(55% 60% at 90% 80%, #2c5aa0 0%, rgba(44,90,160,0) 70%), radial-gradient(120% 90% at 50% 120%, #163a6e 0%, rgba(22,58,110,0) 60%)",
};

export function gyldigBaggrund(v: string | null | undefined): BaggrundId {
  if (v === "billede") return "billede";
  return BAGGRUNDE.some((b) => b.id === v) ? (v as BaggrundId) : STANDARD_BAGGRUND;
}

export function gyldigStyrke(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return STANDARD_STYRKE;
  return Math.max(0, Math.min(MAKS_STYRKE, Math.round(v)));
}

/** CSS-værdien til baggrundslaget. `version` sprænger browserens cache, når billedet skiftes. */
export function moensterCss(id: BaggrundId, version?: string | number): string {
  if (id === "billede") return `url("/api/baggrund${version != null ? `?v=${version}` : ""}")`;
  return MOENSTRE[id];
}
