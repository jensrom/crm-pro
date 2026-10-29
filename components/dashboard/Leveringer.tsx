import Link from "next/link";
import { Truck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { dokNr } from "@/lib/dokumenter";
import { ordreTotal } from "@/lib/ordre-pdf";
import { isoDag } from "@/lib/perioder";
import { AKTIVE_INTERN, PERIODER, periodeFra } from "@/lib/intern";
import { cn } from "@/lib/utils";

/**
 * Leveringsopgørelse: ordrer intern salg har leveret og afsluttet i perioden.
 * Presets (måned, sidste måned, kvartal, år, 12 mdr.) eller egne datoer.
 */
export async function Leveringer({ periode, fra, til }: { periode?: string; fra?: string; til?: string }) {
  const p = periodeFra(periode, fra, til);
  const [leveret, igang] = await Promise.all([
    db.order.findMany({
      where: { internStatus: "afsluttet", internAfsluttetAt: { gte: p.fra, lte: p.til } },
      include: { lines: true, company: { select: { id: true, name: true } } },
      orderBy: { internAfsluttetAt: "desc" },
    }),
    db.order.count({ where: { internStatus: { in: AKTIVE_INTERN } } }),
  ]);
  const vaerdi = leveret.reduce((s, o) => s + ordreTotal(o.lines), 0);
  const kunder = new Set(leveret.map((o) => o.companyId).filter(Boolean)).size;
  const link = (k: string) => `/dashboard?lev=${k}#leveringer`;

  return (
    <Card>
      <div id="leveringer" className="scroll-mt-24" />
      <CardHeader
        title={<span className="flex items-center gap-2"><Truck className="h-4 w-4" />Leveringer</span>}
        description={`Leveret og afsluttet ${datoKort(p.fra)} – ${datoKort(p.til)}`}
        action={<Link href={`/intern?pulje=afsluttet&periode=${p.key}${p.key === "egen" ? `&fra=${isoDag(p.fra)}&til=${isoDag(p.til)}` : ""}`} className="text-xs font-medium text-primary hover:underline">Se listen</Link>}
      />
      <CardBody className="flex flex-col gap-4">
        <form action="/dashboard#leveringer" className="flex flex-wrap items-center gap-1.5">
          {PERIODER.filter((x) => x.key !== "egen").map((x) => (
            <Link key={x.key} href={link(x.key)} scroll={false} className={cn("h-7 px-2.5 inline-flex items-center rounded-md border text-xs", p.key === x.key ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-secondary")}>{x.label}</Link>
          ))}
          <input type="hidden" name="lev" value="egen" />
          <input type="date" name="fra" defaultValue={isoDag(p.fra)} aria-label="Fra" className="felt h-7 px-2 text-xs rounded-md" />
          <span className="text-xs text-muted-foreground">–</span>
          <input type="date" name="til" defaultValue={isoDag(p.til)} aria-label="Til" className="felt h-7 px-2 text-xs rounded-md" />
          <button type="submit" className="knap-glas h-7 px-2.5 rounded-md text-xs font-medium">Vis</button>
        </form>

        <div className="grid grid-cols-3 gap-3">
          <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Leveret</div><div className="text-xl font-semibold tabular">{tal(leveret.length)}</div></div>
          <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Værdi</div><div className="text-xl font-semibold tabular text-primary">{kroner(vaerdi)}</div></div>
          <div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">Kunder</div><div className="text-xl font-semibold tabular">{tal(kunder)}</div></div>
        </div>

        {leveret.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border -mx-5">
            {leveret.slice(0, 6).map((o) => (
              <li key={o.id} className="px-5 py-2 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <Link href={`/ordrer/${o.id}`} className="font-medium tabular hover:text-primary">{dokNr(o)}</Link>
                  <span className="text-muted-foreground"> · {o.company?.name ?? o.recipientName}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular">{datoKort(o.internAfsluttetAt)} · <b className="text-foreground">{kroner(ordreTotal(o.lines))}</b></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ingen leverancer i perioden.</p>
        )}
        <p className="text-xs text-muted-foreground">{tal(igang)} ordrer er i gang hos intern salg.</p>
      </CardBody>
    </Card>
  );
}
