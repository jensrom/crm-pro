"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  KanbanSquare,
  Package,
  CalendarClock,
  ListChecks,
  LifeBuoy,
  Scissors,
  Settings,
  Flame,
  PackagePlus,
  FileText,
  RefreshCw,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: React.ElementType };

const SEKTIONER: { sektion: string; punkter: NavItem[] }[] = [
  {
    sektion: "Overblik",
    punkter: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    sektion: "Kunder",
    punkter: [
      { label: "Kunder", href: "/kunder", icon: Building2 },
      { label: "Hot", href: "/kunder?hot=1", icon: Flame },
      { label: "Kundenotater", href: "/notater", icon: ListChecks },
      { label: "Kontakter", href: "/kontakter", icon: Users },
    ],
  },
  {
    sektion: "Salg",
    punkter: [
      { label: "Pipeline", href: "/pipeline", icon: KanbanSquare },
      { label: "Produkter", href: "/produkter", icon: Package },
      { label: "Tilkøb", href: "/tilkoeb", icon: PackagePlus },
      { label: "Tilbud og ordrer", href: "/ordrer", icon: FileText },
      { label: "Fornyelser", href: "/fornyelser", icon: RefreshCw },
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

export type Brand = {
  subtitle: string | null;
  markText: string | null;
  logo: string | null;
};

export type OpdateringInfo = {
  erNyereTilgaengelig: boolean;
  nyeste: { version: string } | null;
} | null;

export function AppSidebar({
  brand,
  hotAntal = 0,
  opdatering = null,
  visIndstillinger = false,
}: {
  brand: Brand;
  hotAntal?: number;
  opdatering?: OpdateringInfo;
  /** Kun superadministratorer ser Indstillinger */
  visIndstillinger?: boolean;
}) {
  const sti = usePathname();
  const soegeparametre = useSearchParams();
  const aktiv = (href: string) => {
    const [hrefSti, hrefQuery] = href.split("?");
    if (hrefQuery) {
      if (sti !== hrefSti) return false;
      const hrefParametre = new URLSearchParams(hrefQuery);
      for (const [k, v] of hrefParametre.entries()) {
        if (soegeparametre.get(k) !== v) return false;
      }
      return true;
    }
    return sti === hrefSti || sti.startsWith(hrefSti + "/");
  };
  const undertekst = brand.subtitle ?? "Idus Online · DK & FO";
  const maerke = (brand.markText ?? "CP").slice(0, 3);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col border-r"
      style={{
        width: "var(--sidebar-width)",
        background: "hsl(var(--sidebar-bg))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 border-b shrink-0"
        style={{ height: "var(--topbar-height)", borderColor: "hsl(var(--sidebar-border))" }}
      >
        {brand.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={brand.logo} alt="Logo" className="h-7 w-7 rounded-md object-contain bg-white/90 p-0.5 shrink-0" />
        ) : (
          <div className="h-7 w-7 rounded-md bg-primary grid place-items-center text-primary-foreground text-xs font-bold shrink-0">
            {maerke}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-serif text-sm font-semibold leading-tight" style={{ color: "hsl(var(--sidebar-fg-strong))" }}>CRM-Pro</div>
          <div className="text-[10px] leading-tight truncate" style={{ color: "hsl(var(--sidebar-fg))" }}>
            {undertekst}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-4">
        {SEKTIONER.map((s) => (
          <div key={s.sektion}>
            <div
              className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "hsl(var(--sidebar-fg) / 0.55)" }}
            >
              {s.sektion}
            </div>
            <div className="flex flex-col gap-0.5">
              {s.punkter.map((p) => {
                const on = aktiv(p.href);
                const erHot = p.href === "/kunder?hot=1";
                return (
                  <Link
                    key={p.href}
                    href={p.href}
                    aria-current={on ? "page" : undefined}
                    className={cn("nav-item", on ? "font-semibold" : "hover:bg-[hsl(var(--sidebar-hover-bg))] hover:!text-[hsl(var(--sidebar-fg-strong))]")}
                    style={{
                      background: on ? "hsl(var(--sidebar-active-bg))" : undefined,
                      color: on ? "hsl(var(--sidebar-active-fg))" : "hsl(var(--sidebar-fg))",
                    }}
                  >
                    <p.icon className="h-4 w-4 shrink-0" />
                    {p.label}
                    {erHot && hotAntal > 0 && (
                      <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-orange-500 text-white">
                        {hotAntal}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {visIndstillinger && (
      <div className="p-2.5 border-t shrink-0" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Link
          href="/indstillinger"
          className={cn("nav-item", aktiv("/indstillinger") ? "font-semibold" : "hover:bg-[hsl(var(--sidebar-hover-bg))] hover:!text-[hsl(var(--sidebar-fg-strong))]")}
          style={{
            background: aktiv("/indstillinger") ? "hsl(var(--sidebar-active-bg))" : undefined,
            color: aktiv("/indstillinger") ? "hsl(var(--sidebar-active-fg))" : "hsl(var(--sidebar-fg))",
          }}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Indstillinger
          {opdatering?.erNyereTilgaengelig && (
            <span
              className="ml-auto h-2 w-2 rounded-full bg-orange-500 shrink-0"
              title={`Ny version tilgængelig${opdatering.nyeste?.version ? `: ${opdatering.nyeste.version}` : ""}`}
            />
          )}
        </Link>
      </div>
      )}
    </aside>
  );
}
