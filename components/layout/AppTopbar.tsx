"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, LogOut, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Opdatering } from "./Opdatering";
import { logUd } from "@/app/actions/auth";
import { rolleNavn } from "@/lib/roller";

const TITLER: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/kunder": "Kunder",
  "/kontakter": "Kontakter",
  "/leads": "Leads",
  "/opportunities": "Opportunities",
  "/ordrer": "Ordreliste",
  "/fornyelser": "Fornyelser",
  "/tilkoeb": "Tilkøb",
  "/produkter": "Produkter",
  "/teknik": "Teknik",
  "/aktiviteter": "Aktiviteter",
  "/indstillinger": "Indstillinger",
};

export type TopbarBruger = { initials: string; name: string; erAdmin: boolean; erSuperAdmin?: boolean; role?: string };

export function AppTopbar({ bruger, maerke }: { bruger: TopbarBruger; maerke?: { logo: string | null; tekst: string | null } }) {
  const sti = usePathname();
  const rod = "/" + (sti.split("/")[1] ?? "");
  const titel = TITLER[rod] ?? (rod === "/notater" ? "Kundenotater" : "CRM-Pro");

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 sm:gap-4 border-b border-border bg-background/90 backdrop-blur px-4 sm:px-5"
      style={{ height: "var(--topbar-height)", paddingTop: "env(safe-area-inset-top)", boxSizing: "content-box" }}
    >
      <Link href="/dashboard" className="lg:hidden shrink-0" aria-label="Til dashboard">
        {maerke?.logo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={maerke.logo} alt="" className="h-7 w-7 object-contain bg-white/90 p-0.5" />
        ) : (
          <div className="h-7 w-7 bg-primary grid place-items-center text-primary-foreground text-[10px] font-bold">
            {(maerke?.tekst ?? "CP").slice(0, 3)}
          </div>
        )}
      </Link>
      <h1 className="text-[15px] lg:text-sm font-semibold truncate">{titel}</h1>

      <div className="ml-auto flex items-center gap-3">
        <span
          className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground"
          title={`${bruger.name} — ${rolleNavn(bruger.role ?? "")}`}
        >
          {bruger.erSuperAdmin ? <Crown className="h-3.5 w-3.5 text-primary" /> : bruger.erAdmin && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          <span className="font-medium text-foreground tracking-wide">{bruger.initials}</span>
          <span className="hidden md:inline">{bruger.name}</span>
          <span className="hidden lg:inline text-[11px] px-1.5 py-0.5 border border-border bg-secondary">{rolleNavn(bruger.role ?? "")}</span>
        </span>
        <Opdatering />
        <span className="hidden lg:contents">
          <ThemeToggle />
        </span>
        <form action={logUd} className="hidden lg:block">
          <button
            type="submit"
            aria-label="Log ud"
            title="Log ud"
            className="h-8 w-8 grid place-items-center rounded-lg border border-border hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
