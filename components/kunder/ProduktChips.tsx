import { ProduktMaerke } from "@/lib/produktstil";
import { cn } from "@/lib/utils";
import type { KundeProdukt } from "@/lib/kundeprodukter";

/** Én mærkat pr. produkt med antal licenser. Gul = en licens under produktet mangler pris. */
export function ProduktChips({ produkter }: { produkter: KundeProdukt[] }) {
  if (produkter.length === 0) return <span className="text-muted-foreground">Ingen</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {produkter.map((p) => (
        <span
          key={p.navn}
          title={`${p.linjer.join("\n")}${p.udenPris ? "\n— mindst én licens uden pris" : ""}`}
          className={cn(
            "inline-flex items-center gap-1.5 h-6 pl-1 pr-2 rounded-sm border text-xs whitespace-nowrap",
            p.udenPris ? "border-warning/50 bg-warning/[0.08]" : "border-border bg-secondary/50"
          )}
        >
          <ProduktMaerke icon={p.ikon} color={p.farve} size="sm" />
          <span className="font-medium">{p.navn}</span>
          <span className="text-muted-foreground tabular">{p.licenser}</span>
        </span>
      ))}
    </span>
  );
}
