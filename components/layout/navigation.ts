/**
 * Menuen ét sted: sidebjælken på store skærme og bundmenuen + menuskuffen på
 * mobilen læser den samme liste, så de aldrig kommer ud af trit.
 */
import {
  LayoutDashboard,
  Building2,
  Users,
  KanbanSquare,
  Package,
  CalendarClock,
  Inbox,
  LifeBuoy,
  Scissors,
  Flame,
  PackagePlus,
  FileText,
  RefreshCw,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: React.ElementType; boern?: NavItem[]; skilleFoer?: boolean };

export const SEKTIONER: { sektion: string; punkter: NavItem[] }[] = [
  {
    sektion: "Overblik",
    punkter: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    sektion: "Kunder",
    punkter: [
      {
        label: "Kunder",
        href: "/kunder",
        icon: Building2,
        boern: [
          { label: "Kontakter", href: "/kontakter", icon: Users },
          { label: "Hot", href: "/kunder?hot=1", icon: Flame },
        ],
      },
    ],
  },
  {
    sektion: "Salg",
    punkter: [
      { label: "Leads", href: "/leads", icon: Inbox },
      { label: "Opportunities", href: "/opportunities", icon: KanbanSquare },
      { label: "Ordreliste", href: "/ordrer", icon: FileText },
      { label: "Fornyelser", href: "/fornyelser", icon: RefreshCw, skilleFoer: true },
      { label: "Tilkøb", href: "/tilkoeb", icon: PackagePlus },
      { label: "Produkter", href: "/produkter", icon: Package },
    ],
  },
  {
    sektion: "Teknik",
    punkter: [
      { label: "Sager", href: "/teknik/sager", icon: LifeBuoy },
      { label: "Klippekort", href: "/teknik/klippekort", icon: Scissors },
    ],
  },
  {
    sektion: "Arbejde",
    punkter: [{ label: "Aktiviteter", href: "/aktiviteter", icon: CalendarClock }],
  },
];


/** Sektioner brugerens rolle giver adgang til. */
export function synligeSektioner(omraader: { salg: boolean; teknik: boolean }) {
  return SEKTIONER.filter((s) =>
    s.sektion === "Salg" || s.sektion === "Arbejde" ? omraader.salg : s.sektion === "Teknik" ? omraader.teknik : true
  );
}

/** Er menupunktet det aktive? Punkter med ?query skal matche parametrene præcist. */
export function erAktiv(href: string, sti: string, soegeparametre: URLSearchParams | { get(k: string): string | null }) {
  const [hrefSti, hrefQuery] = href.split("?");
  if (hrefQuery) {
    if (sti !== hrefSti) return false;
    for (const [k, v] of new URLSearchParams(hrefQuery).entries()) {
      if (soegeparametre.get(k) !== v) return false;
    }
    return true;
  }
  return sti === hrefSti || sti.startsWith(hrefSti + "/");
}
