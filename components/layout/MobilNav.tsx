"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Crown, KanbanSquare, LayoutDashboard, LifeBuoy, LogOut, Menu, Settings, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logUd } from "@/app/actions/auth";
import { rolleNavn } from "@/lib/roller";
import { ThemeToggle } from "./ThemeToggle";
import { erAktiv, synligeSektioner, type NavItem } from "./navigation";
import type { Brand } from "./AppSidebar";

type MobilBruger = { initials: string; name: string; role?: string; erAdmin: boolean; erSuperAdmin?: boolean };

/**
 * Mobilnavigation: en fast bundmenu med de fire steder man bruger mest, og
 * en menuskuffe med resten. Kun under lg — på store skærme står sidebjælken.
 */
export function MobilNav({
  brand,
  hotAntal = 0,
  visIndstillinger = false,
  omraader = { salg: true, teknik: true },
  bruger,
}: {
  brand: Brand;
  hotAntal?: number;
  visIndstillinger?: boolean;
  omraader?: { salg: boolean; teknik: boolean };
  bruger: MobilBruger;
}) {
  const sti = usePathname();
  const soeg = useSearchParams();
  const [aaben, setAaben] = useState(false);
  const aktiv = (href: string) => erAktiv(href, sti, soeg);

  // Skuffen lukker ved sideskift og på Escape, og siden bag den står stille.
  useEffect(() => setAaben(false), [sti, soeg]);
  useEffect(() => {
    if (!aaben) return;
    const luk = (e: KeyboardEvent) => e.key === "Escape" && setAaben(false);
    const foer = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", luk);
    return () => {
      document.body.style.overflow = foer;
      window.removeEventListener("keydown", luk);
    };
  }, [aaben]);

  const faste: NavItem[] = [
    { label: "Overblik", href: "/dashboard", icon: LayoutDashboard },
    { label: "Kunder", href: "/kunder", icon: Building2 },
    ...(omraader.salg ? [{ label: "Salg", href: "/opportunities", icon: KanbanSquare }] : []),
    ...(omraader.teknik ? [{ label: "Sager", href: "/teknik/sager", icon: LifeBuoy }] : []),
  ];
  // "Kunder" i bundmenuen dækker også kontakter, men ikke Hot-filteret, som har sit eget punkt i skuffen.
  const under = (...rod: string[]) => rod.some((r) => sti === r || sti.startsWith(r + "/"));
  const fastAktiv = (href: string) => {
    if (href === "/kunder") return (sti === "/kunder" && soeg.get("hot") !== "1") || sti.startsWith("/kunder/") || under("/kontakter", "/notater");
    if (href === "/opportunities") return under("/opportunities", "/leads", "/ordrer", "/fornyelser", "/tilkoeb", "/produkter", "/pipeline", "/aktiviteter");
    if (href === "/teknik/sager") return under("/teknik");
    return aktiv(href);
  };
  const ingenFastAktiv = !faste.some((f) => fastAktiv(f.href));

  const undertekst = brand.subtitle ?? "Idus Online · DK & FO";
  const maerke = (brand.markText ?? "CP").slice(0, 3);

  return (
    <>
      {/* ---------- Bundmenu ---------- */}
      <nav
        aria-label="Hovedmenu"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch">
          {faste.map((p) => {
            const on = fastAktiv(p.href);
            return (
              <li key={p.href} className="flex-1">
                <Link
                  href={p.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    on ? "text-foreground" : "text-muted-foreground active:text-foreground"
                  )}
                >
                  <span className={cn("absolute top-0 inset-x-5 h-[2px] transition-colors", on ? "bg-foreground" : "bg-transparent")} />
                  <p.icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.1 : 1.7} />
                  {p.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setAaben(true)}
              aria-expanded={aaben}
              aria-controls="mobilmenu"
              className={cn(
                "relative flex h-[60px] w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                aaben || ingenFastAktiv ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span className={cn("absolute top-0 inset-x-5 h-[2px]", ingenFastAktiv ? "bg-foreground" : "bg-transparent")} />
              <span className="relative">
                <Menu className="h-[22px] w-[22px]" strokeWidth={ingenFastAktiv ? 2.1 : 1.7} />
                {hotAntal > 0 && <span className="absolute -top-0.5 -right-1 h-2 w-2 bg-orange-500" />}
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>

      {/* ---------- Menuskuffe ---------- */}
      <div
        className={cn("lg:hidden fixed inset-0 z-50 transition-[visibility] duration-300", aaben ? "visible" : "invisible")}
        aria-hidden={!aaben}
      >
        <button
          type="button"
          aria-label="Luk menu"
          tabIndex={-1}
          onClick={() => setAaben(false)}
          className={cn("absolute inset-0 bg-[hsl(220_10%_8%/0.38)] transition-opacity duration-300", aaben ? "opacity-100" : "opacity-0")}
        />
        <div
          id="mobilmenu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={cn(
            "absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col border-t border-border bg-background shadow-[0_-12px_40px_rgba(20,22,26,0.18)]",
            "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
            aaben ? "translate-y-0" : "translate-y-full"
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Hoved: mærke og bruger */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            {brand.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={brand.logo} alt="Logo" className="h-9 w-9 object-contain bg-white/90 p-0.5 shrink-0" />
            ) : (
              <div className="h-9 w-9 bg-primary grid place-items-center text-primary-foreground text-xs font-bold shrink-0">{maerke}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[15px] font-semibold leading-tight">CRM-Pro</div>
              <div className="text-xs text-muted-foreground truncate">{undertekst}</div>
            </div>
            <button
              type="button"
              onClick={() => setAaben(false)}
              aria-label="Luk menu"
              className="h-10 w-10 grid place-items-center border border-border text-muted-foreground active:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {synligeSektioner(omraader).map((s) => (
              <section key={s.sektion} className="mb-3 last:mb-0">
                <h3 className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{s.sektion}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {s.punkter.flatMap((p) => [p, ...(p.boern ?? [])]).map((p) => {
                    const on = aktiv(p.href) && !(p.href === "/kunder" && soeg.get("hot") === "1");
                    const erHot = p.href === "/kunder?hot=1";
                    return (
                      <Link
                        key={p.href}
                        href={p.href}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "flex h-12 items-center gap-2.5 border px-3 text-sm font-medium transition-colors",
                          on ? "border-foreground/25 bg-secondary text-foreground" : "border-border bg-card text-foreground/85 active:bg-secondary"
                        )}
                      >
                        <p.icon className={cn("h-[18px] w-[18px] shrink-0", erHot ? "text-orange-500" : "text-muted-foreground")} />
                        <span className="truncate">{p.label}</span>
                        {erHot && hotAntal > 0 && (
                          <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 bg-orange-500 text-white">{hotAntal}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
            {visIndstillinger && (
              <Link
                href="/indstillinger"
                className={cn(
                  "mt-1 flex h-12 items-center gap-2.5 border px-3 text-sm font-medium",
                  aktiv("/indstillinger") ? "border-foreground/25 bg-secondary" : "border-border bg-card active:bg-secondary"
                )}
              >
                <Settings className="h-[18px] w-[18px] text-muted-foreground" />
                Indstillinger
              </Link>
            )}
          </div>

          {/* Fod: bruger, tema og log ud */}
          <div className="flex items-center gap-3 border-t border-border px-4 py-3">
            <div className="h-9 w-9 grid place-items-center bg-secondary text-xs font-semibold tracking-wide shrink-0">{bruger.initials}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {bruger.erSuperAdmin ? <Crown className="h-3.5 w-3.5" /> : bruger.erAdmin && <ShieldCheck className="h-3.5 w-3.5" />}
                {bruger.name}
              </div>
              <div className="text-xs text-muted-foreground">{rolleNavn(bruger.role ?? "")}</div>
            </div>
            <ThemeToggle stor />
            <form action={logUd}>
              <button type="submit" aria-label="Log ud" className="h-10 w-10 grid place-items-center border border-border active:bg-secondary">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
