import Link from "next/link";
import { Download, FileText, Plus, Search } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { dokNr } from "@/lib/dokumenter";
import { ordreTotal } from "@/lib/ordre-pdf";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Ordreliste — alle tilbud og ordrebekræftelser samlet ét sted.
 * Hver anden linje har en svag nuance, så øjet kan følge en række hele vejen over.
 */
export default async function OrdrelisteSide({
  searchParams,
}: {
  searchParams: Promise<{ kunde?: string; besked?: string; type?: string; q?: string }>;
}) {
  const { kunde, besked, type, q } = await searchParams;
  const soeg = q?.trim() ?? "";
  const tal_ = Number(soeg.replace(/\D/g, ""));

  const ordrer = await db.order.findMany({
    where: {
      ...(kunde ? { companyId: kunde } : {}),
      ...(type === "tilbud" || type === "ordre" ? { kind: type } : {}),
      ...(soeg
        ? {
            OR: [
              { recipientName: { contains: soeg, mode: "insensitive" as const } },
              { reference: { contains: soeg, mode: "insensitive" as const } },
              ...(Number.isFinite(tal_) && tal_ > 0 ? [{ number: tal_ }] : []),
            ],
          }
        : {}),
    },
    include: { lines: true, company: { select: { id: true, name: true } } },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const nu = new Date();
  const ordreDok = ordrer.filter((o) => o.kind === "ordre");
  const tilbud = ordrer.filter((o) => o.kind === "tilbud");
  const aabneTilbud = tilbud.filter((o) => !o.validUntil || o.validUntil >= nu);
  const iAar = ordreDok.filter((o) => o.orderDate.getFullYear() === nu.getFullYear());
  const sumIAar = iAar.reduce((s, o) => s + ordreTotal(o.lines), 0);
  const sumOrdrer = ordreDok.reduce((s, o) => s + ordreTotal(o.lines), 0);
  const sumTilbud = tilbud.reduce((s, o) => s + ordreTotal(o.lines), 0);

  const href = (aendr: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const alle = { kunde, type, q: soeg || undefined, ...aendr };
    for (const [k, v] of Object.entries(alle)) if (v) p.set(k, v);
    const s = p.toString();
    return `/ordrer${s ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-[1300px] flex flex-col gap-5">
      {besked === "slettet" && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">Ordren er slettet. PDF'en i kundens filboks er bevaret.</CardBody></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ordrer i alt" value={tal(ordreDok.length)} sub={`${tal(tilbud.length)} tilbud`} />
        <StatCard label={`Ordreværdi ${nu.getFullYear()}`} value={sumIAar > 0 ? kroner(sumIAar) : "–"} sub={`${tal(iAar.length)} ordrer i år`} highlight />
        <StatCard label="Gyldige tilbud" value={tal(aabneTilbud.length)} sub="ikke udløbet" />
        <StatCard label="Ikke overført" value={tal(ordreDok.filter((o) => o.companyId && !o.appliedAt).length)} sub="ordrer ikke lagt på kundens aftaler" />
      </div>

      <Card>
        <CardHeader
          title="Ordreliste"
          description={`${tal(ordrer.length)} dokumenter${kunde && ordrer[0]?.company ? ` for ${ordrer[0].company.name}` : ""}${soeg ? ` der matcher "${soeg}"` : ""}. PDF'en genskabes altid ud fra det gemte dokument.`}
          action={
            <div className="flex items-center gap-2">
              <Link href={`/ordrer/ny?type=tilbud${kunde ? `&kunde=${kunde}` : ""}`}><Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Tilbud</Button></Link>
              <Link href={`/ordrer/ny?type=ordre${kunde ? `&kunde=${kunde}` : ""}`}><Button size="sm"><Plus className="h-3.5 w-3.5" /> Ordrebekræftelse</Button></Link>
            </div>
          }
        />

        <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {([["", "Alle"], ["ordre", "Ordrer"], ["tilbud", "Tilbud"]] as const).map(([k, l]) => (
              <Link
                key={k}
                href={href({ type: k || undefined })}
                className={cn("px-3 py-1.5 transition-colors", (type ?? "") === k ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
              >
                {l}
              </Link>
            ))}
          </div>
          <form action="/ordrer" className="flex items-center gap-2 ml-auto">
            {kunde && <input type="hidden" name="kunde" value={kunde} />}
            {type && <input type="hidden" name="type" value={type} />}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={soeg} placeholder="Nummer, kunde eller reference" className="h-8 text-xs pl-8 w-64" />
            </div>
            {(soeg || kunde) && <Link href={href({ q: undefined, kunde: undefined })} className="text-xs text-primary hover:underline">Nulstil</Link>}
          </form>
        </div>

        <CardBody className="p-0">
          {ordrer.length === 0 ? (
            <div className="px-5"><EmptyState title={soeg ? "Ingen dokumenter matcher" : "Ingen tilbud eller ordrer endnu"} icon={FileText} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-card">
                    <th className="px-5 py-2.5 font-medium">Nummer</th>
                    <th className="px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Dato</th>
                    <th className="px-3 py-2.5 font-medium">Kunde / modtager</th>
                    <th className="px-3 py-2.5 font-medium">Reference</th>
                    <th className="px-3 py-2.5 font-medium text-right">Linjer</th>
                    <th className="px-3 py-2.5 font-medium text-right">Beløb ekskl. moms</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Af</th>
                    <th className="px-5 py-2.5 font-medium text-right"><span className="sr-only">PDF</span></th>
                  </tr>
                </thead>
                <tbody>
                  {ordrer.map((o) => {
                    const erTilbud = o.kind === "tilbud";
                    const fornyelse = o.lines.some((l) => l.lineKind === "fornyelse");
                    const udloebet = erTilbud && o.validUntil != null && o.validUntil < nu;
                    return (
                      <tr key={o.id} className="border-b border-border/60 last:border-0 even:bg-muted/45 hover:bg-primary/[0.05] transition-colors">
                        <td className="px-5 py-2.5 font-medium tabular whitespace-nowrap">
                          <Link href={`/ordrer/${o.id}`} className="hover:text-primary">{dokNr(o)}</Link>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {erTilbud ? <Badge variant="warning">Tilbud</Badge> : <Badge variant="default">Ordre</Badge>}
                            {fornyelse && <Badge variant="info">Fornyelse</Badge>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tabular text-muted-foreground whitespace-nowrap">{datoKort(o.orderDate)}</td>
                        <td className="px-3 py-2.5 min-w-[180px]">
                          {o.company
                            ? <Link href={`/kunder/${o.company.id}?fane=salg`} className="hover:text-primary">{o.company.name}</Link>
                            : <span>{o.recipientName} <span className="text-xs text-muted-foreground">(ingen kunde)</span></span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{o.reference ?? "–"}</td>
                        <td className="px-3 py-2.5 text-right tabular">{o.lines.length}</td>
                        <td className="px-3 py-2.5 text-right tabular font-medium whitespace-nowrap">{kroner(ordreTotal(o.lines))}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {erTilbud
                            ? o.validUntil
                              ? <span className={udloebet ? "text-muted-foreground" : "text-foreground"}>{udloebet ? "Udløbet" : `Gyldig til ${datoKort(o.validUntil)}`}</span>
                              : <span className="text-muted-foreground">–</span>
                            : o.appliedAt
                              ? <span className="text-success">Overført {datoKort(o.appliedAt)}</span>
                              : o.companyId ? <span className="text-warning">Ikke overført</span> : <span className="text-muted-foreground">–</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{o.createdBy ?? "–"}</td>
                        <td className="px-5 py-2 text-right">
                          <a href={`/api/dokumenter/ordre/${o.id}`} title="Hent PDF" aria-label={`Hent PDF for ${dokNr(o)}`} className="inline-grid place-items-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border text-xs">
                    <td colSpan={6} className="px-5 py-2.5 text-muted-foreground">{tal(ordrer.length)} dokumenter{ordrer.length === 500 ? " (de 500 nyeste)" : ""}</td>
                    <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
                      {ordreDok.length > 0 && <div className="font-semibold">{kroner(sumOrdrer)}</div>}
                      {tilbud.length > 0 && <div className="text-muted-foreground">tilbud {kroner(sumTilbud)}</div>}
                    </td>
                    <td colSpan={3} className="px-3 py-2.5 text-muted-foreground align-top">{ordreDok.length > 0 && "ordrer i alt"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
