"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, LogOut, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Opdatering } from "./Opdatering";
import { logUd } from "@/app/actions/auth";

const TITLER: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/kunder": "Kunder",
  "/notater": "Kundenotater",
  "/kontakter": "Kontakter",
  "/pipeline": "Pipeline",
  "/produkter": "Produkter",
  "/tilkoeb": "Tilkøb",
  "/teknik": "Teknik",
  "/aktiviteter": "Aktiviteter",
  "/indstillinger": "Indstillinger",
};

export type TopbarBruger = { initials: string; name: string; erAdmin: boolean; erSuperAdmin?: boolean };

export function AppTopbar({ bruger }: { bruger: TopbarBruger }) {
  const sti = usePathname();
  const rod = "/" + (sti.split("/")[1] ?? "");
  const titel = TITLER[rod] ?? "CRM-Pro";

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/90 backdrop-blur px-5"
      style={{ height: "var(--topbar-height)" }}
    >
      <div className="lg:hidden flex items-center gap-2">
        <div className="h-6 w-6 rounded bg-primary grid place-items-center text-primary-foreground text-[10px] font-bold">CP</div>
      </div>
      <h1 className="text-sm font-semibold">{titel}</h1>
      <nav className="lg:hidden flex items-center gap-3 text-xs text-muted-foreground overflow-x-auto">
        {Object.entries(TITLER).map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap hover:text-foreground">
            {label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span
          className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground"
          title={bruger.erSuperAdmin ? `${bruger.name} — superadministrator` : bruger.erAdmin ? `${bruger.name} — administrator` : bruger.name}
        >
          {bruger.erSuperAdmin ? <Crown className="h-3.5 w-3.5 text-primary" /> : bruger.erAdmin && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          <span className="font-medium text-foreground tracking-wide">{bruger.initials}</span>
          <span className="hidden md:inline">{bruger.name}</span>
        </span>
        <Opdatering />
        <ThemeToggle />
        <form action={logUd}>
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
