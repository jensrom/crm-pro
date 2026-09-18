import {
  Award,
  Box,
  Boxes,
  Briefcase,
  Crown,
  Diamond,
  Gem,
  Layers,
  Package,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

/** Det faste udvalg af mærker et produkt kan bære. */
export const IKONER = [
  { key: "package",   label: "Pakke",       Icon: Package },
  { key: "box",       label: "Kasse",       Icon: Box },
  { key: "boxes",     label: "Kasser",      Icon: Boxes },
  { key: "layers",    label: "Lag",         Icon: Layers },
  { key: "star",      label: "Stjerne",     Icon: Star },
  { key: "crown",     label: "Krone",       Icon: Crown },
  { key: "award",     label: "Medalje",     Icon: Award },
  { key: "gem",       label: "Ædelsten",    Icon: Gem },
  { key: "diamond",   label: "Diamant",     Icon: Diamond },
  { key: "shield",    label: "Skjold",      Icon: Shield },
  { key: "zap",       label: "Lyn",         Icon: Zap },
  { key: "rocket",    label: "Raket",       Icon: Rocket },
  { key: "sparkles",  label: "Glimt",       Icon: Sparkles },
  { key: "briefcase", label: "Mappe",       Icon: Briefcase },
] as const;

export type IkonNoegle = (typeof IKONER)[number]["key"];

/**
 * Farverne. Guld, sølv og bronze står først, fordi det er den rangorden
 * pakker oftest læses i. Alle er valgt så hvid tekst og ikon holder
 * kontrasten på både lys og mørk baggrund.
 */
export const FARVER = [
  { key: "guld",   label: "Guld",   bg: "#B8860B", fg: "#FFFFFF" },
  { key: "soelv",  label: "Sølv",   bg: "#71797E", fg: "#FFFFFF" },
  { key: "bronze", label: "Bronze", bg: "#A05A2C", fg: "#FFFFFF" },
  { key: "blaa",   label: "Blå",    bg: "#2563EB", fg: "#FFFFFF" },
  { key: "groen",  label: "Grøn",   bg: "#047857", fg: "#FFFFFF" },
  { key: "roed",   label: "Rød",    bg: "#B91C1C", fg: "#FFFFFF" },
  { key: "lilla",  label: "Lilla",  bg: "#6D28D9", fg: "#FFFFFF" },
  { key: "graa",   label: "Grå",    bg: "#475569", fg: "#FFFFFF" },
] as const;

export type FarveNoegle = (typeof FARVER)[number]["key"];

export const STANDARDFARVE = FARVER[7];

export const findIkon = (key: string | null | undefined) =>
  IKONER.find((i) => i.key === key) ?? IKONER[0];

export const findFarve = (key: string | null | undefined) =>
  FARVER.find((f) => f.key === key) ?? STANDARDFARVE;

const STOERRELSER = {
  sm: { boks: 20, ikon: 12, radius: 5 },
  md: { boks: 28, ikon: 16, radius: 7 },
  lg: { boks: 40, ikon: 22, radius: 10 },
} as const;

/** Produktets mærke: ikonet i produktets egen farve. */
export function ProduktMaerke({
  icon,
  color,
  size = "md",
  className,
}: {
  icon?: string | null;
  color?: string | null;
  size?: keyof typeof STOERRELSER;
  className?: string;
}) {
  const { Icon } = findIkon(icon);
  const f = findFarve(color);
  const s = STOERRELSER[size];
  return (
    <span
      className={className}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: s.boks,
        height: s.boks,
        borderRadius: s.radius,
        background: f.bg,
        color: f.fg,
        flex: "none",
      }}
      aria-hidden
    >
      <Icon width={s.ikon} height={s.ikon} strokeWidth={2.2} />
    </span>
  );
}

/** Mærke plus navn — den kombination der bruges i lister og tabeller. */
export function ProduktNavn({
  navn,
  icon,
  color,
  size = "sm",
  className,
}: {
  navn: string;
  icon?: string | null;
  color?: string | null;
  size?: keyof typeof STOERRELSER;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className ?? ""}`}>
      <ProduktMaerke icon={icon} color={color} size={size} />
      <span className="truncate">{navn}</span>
    </span>
  );
}
