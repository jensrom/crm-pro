import Link from "next/link";
import { LifeBuoy, ListChecks, Package, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Faner på kundesiden. Fanen ligger i URL'en (?fane=salg|produkter|teknik|notater), så den
 * overlever gem/opdatering, kan bogmærkes og deles med en kollega.
 */
export function KundeFaner({
  kundeId,
  aktiv,
  salg,
  teknik,
  notater,
  produkter,
}: {
  kundeId: string;
  aktiv: "salg" | "produkter" | "teknik" | "notater";
  produkter: number;
  salg: number;
  teknik: number;
  notater: number;
}) {
  const faner = [
    { key: "salg" as const, label: "Salg", ikon: TrendingUp, antal: salg, hint: "åbne muligheder" },
    { key: "produkter" as const, label: "Produkter", ikon: Package, antal: produkter, hint: "produktlinjer" },
    { key: "teknik" as const, label: "Teknik", ikon: LifeBuoy, antal: teknik, hint: "åbne sager" },
    { key: "notater" as const, label: "Notater", ikon: ListChecks, antal: notater, hint: "åbne notater" },
  ];

  return (
    <nav className="flex items-center gap-1 border-b border-border" aria-label="Kundens områder">
      {faner.map((f) => {
        const erAktiv = f.key === aktiv;
        const Ikon = f.ikon;
        return (
          <Link
            key={f.key}
            href={`/kunder/${kundeId}?fane=${f.key}`}
            scroll={false}
            aria-current={erAktiv ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              erAktiv ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Ikon className={cn("h-4 w-4", erAktiv ? "text-primary" : "text-muted-foreground")} />
            {f.label}
            <span
              title={`${f.antal} ${f.hint}`}
              className={cn(
                "min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] tabular grid place-items-center",
                erAktiv ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {f.antal}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
