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
    <nav className="fanerække spor self-start" aria-label="Kundens områder">
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
              "pille"
            )}
          >
            <Ikon className={cn("h-4 w-4", erAktiv ? "text-primary" : "text-muted-foreground")} />
            {f.label}
            {f.antal != null && (
              <span
                title={f.hint ? `${f.antal} ${f.hint}` : undefined}
                className={cn(
                  "min-w-[1.25rem] h-5 px-1.5 rounded-sm text-[11px] tabular grid place-items-center",
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
