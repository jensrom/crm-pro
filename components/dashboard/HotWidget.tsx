import Link from "next/link";
import { Flame } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { tidspunkt } from "@/lib/format";

export type HotRaekke = { id: string; name: string; hotSince: Date | null; hotSetBy: string | null };

/**
 * Kunder markeret "Hot" af en tekniker -- mulighed for at hente flere timer
 * lige nu. Vises kun naar der er mindst én.
 */
export function HotWidget({ rows }: { rows: HotRaekke[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="border-orange-300/60 bg-orange-500/[0.03]">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Hot — mulighed for flere timer
          </span>
        }
        description="Kunder en tekniker har markeret lige nu."
        action={<Link href="/kunder?hot=1" className="text-xs font-medium text-primary hover:underline">Alle</Link>}
      />
      <CardBody className="p-0">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
              <Link href={`/kunder/${r.id}`} className="text-sm font-medium hover:text-primary truncate">{r.name}</Link>
              <span className="text-xs text-muted-foreground tabular shrink-0">
                {r.hotSetBy ? `${r.hotSetBy} · ` : ""}{tidspunkt(r.hotSince)}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
