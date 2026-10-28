"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import { synligeSektioner, erAktiv, type NavItem } from "./navigation";

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
  omraader = { salg: true, teknik: true },
}: {
  brand: Brand;
  hotAntal?: number;
  opdatering?: OpdateringInfo;
  /** Kun superadministratorer ser Indstillinger */
  visIndstillinger?: boolean;
  /** Hvilke områder brugerens rolle giver adgang til */
  omraader?: { salg: boolean; teknik: boolean };
}) {
  const synlige = synligeSektioner(omraader);
  const sti = usePathname();
  const soegeparametre = useSearchParams();
  const aktiv = (href: string) => erAktiv(href, sti, soegeparametre);
  const undertekst = brand.subtitle ?? "Idus Online · DK & FO";
  const maerke = (brand.markText ?? "CP").slice(0, 3);

  return (
    <aside
      className="glas-panel fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div
        className="flex items-center gap-2.5 px-4 border-b shrink-0"
        style={{ height: "var(--topbar-height)", borderColor: "hsl(var(--sidebar-border))" }}
      >
        {brand.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={brand.logo} alt="Logo" className="h-7 w-7 rounded-md object-contain bg-white/90 p-0.5 shrink-0" />
        ) : (
          <div className="knap-glossy h-8 w-8 rounded-md grid place-items-center text-xs font-bold shrink-0">
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
        {synlige.map((s) => (
          <div key={s.sektion}>
            <div
              className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "hsl(var(--sidebar-fg) / 0.55)" }}
            >
              {s.sektion}
            </div>
            <div className="flex flex-col gap-0.5">
              {s.punkter.map((p) => {
                const barnAktivt = p.boern?.some((b) => aktiv(b.href)) ?? false;
                return (
                  <div key={p.href} className="flex flex-col gap-0.5">
                    {p.skilleFoer && <div className="mx-3 my-1.5 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }} />}
                    <NavLink punkt={p} on={aktiv(p.href) && !barnAktivt} hotAntal={hotAntal} />
                    {p.boern && (
                      <div className="ml-[1.35rem] pl-2 border-l flex flex-col gap-0.5" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
                        {p.boern.map((b) => (
                          <NavLink key={b.href} punkt={b} on={aktiv(b.href)} hotAntal={hotAntal} lille />
                        ))}
                      </div>
                    )}
                  </div>
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
          className={cn("nav-item", aktiv("/indstillinger") ? "nav-on font-semibold" : "hover:bg-[color:var(--hover)] hover:!text-[hsl(var(--sidebar-fg-strong))]")}
          style={{
            background: aktiv("/indstillinger") ? "hsl(var(--sidebar-active-bg))" : undefined,
            color: aktiv("/indstillinger") ? "hsl(var(--sidebar-active-fg))" : "hsl(var(--sidebar-fg))",
          }}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Indstillinger
          {opdatering?.erNyereTilgaengelig && (
            <span
              className="ml-auto h-2 w-2 rounded-full bg-hot shrink-0"
              title={`Ny version tilgængelig${opdatering.nyeste?.version ? `: ${opdatering.nyeste.version}` : ""}`}
            />
          )}
        </Link>
      </div>
      )}
    </aside>
  );
}

function NavLink({ punkt: p, on, hotAntal, lille }: { punkt: NavItem; on: boolean; hotAntal: number; lille?: boolean }) {
  const erHot = p.href === "/kunder?hot=1";
  return (
    <Link
      href={p.href}
      aria-current={on ? "page" : undefined}
      className={cn("nav-item", lille && "!py-1.5 text-[13px]", on ? "nav-on font-semibold" : "hover:bg-[color:var(--hover)] hover:!text-[hsl(var(--sidebar-fg-strong))]")}
      style={{
        background: on ? "hsl(var(--sidebar-active-bg))" : undefined,
        color: on ? "hsl(var(--sidebar-active-fg))" : "hsl(var(--sidebar-fg))",
      }}
    >
      <p.icon className={cn("shrink-0", lille ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {p.label}
      {erHot && hotAntal > 0 && (
        <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-sm bg-hot text-white">
          {hotAntal}
        </span>
      )}
    </Link>
  );
}
