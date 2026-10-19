import Link from "next/link";
import { cn } from "@/lib/utils";

export type KundeFane = {
  key: string;
  label: string;
  ikon: React.ElementType;
  /** Tal i mærket ved fanen. Udelades for faner uden en optælling. */
  antal?: number;
  hint?: string;
};

/**
 * Faner på kundesiden. Hver fane viser kun sit eget indhold. Fanen ligger i
 * URL'en (?fane=…), så den overlever gem/opdatering, kan bogmærkes og deles.
 * Siden bestemmer selv, hvilke faner brugerens rolle må se.
 */
export function KundeFaner({ kundeId, aktiv, faner }: { kundeId: string; aktiv: string; faner: KundeFane[] }) {
  return (
    <nav className="fanerække flex items-center gap-1 border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Kundens områder">
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
              "inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              erAktiv ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Ikon className={cn("h-4 w-4", erAktiv ? "text-primary" : "text-muted-foreground")} />
            {f.label}
            {f.antal != null && (
              <span
                title={f.hint ? `${f.antal} ${f.hint}` : undefined}
                className={cn(
                  "min-w-[1.25rem] h-5 px-1.5 rounded-none text-[11px] tabular grid place-items-center",
                  erAktiv ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {f.antal}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
