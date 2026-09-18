import { navnFor } from "@/lib/brugere";
import { tidspunkt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * "Sidst gemt af Michael Hansen · i dag 14:32"
 *
 * Står ved hver gem-knap, så man kan se om det man kigger på er ens eget
 * eller noget en kollega har rørt siden.
 */
export async function GemtAf({
  af,
  tid,
  praefiks = "Sidst gemt",
  className,
}: {
  af?: string | null;
  tid?: Date | string | null;
  praefiks?: string;
  className?: string;
}) {
  if (!tid) return null;
  const navn = await navnFor(af);

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {navn ? `${praefiks} af ${navn} · ` : `${praefiks} `}
      <span className="tabular">{tidspunkt(tid)}</span>
    </p>
  );
}
