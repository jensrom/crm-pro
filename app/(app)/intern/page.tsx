import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { kraevBruger } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";
import { datoKort, kroner, tal } from "@/lib/format";
import { dokNr, subNr } from "@/lib/dokumenter";
import { ordreTotal } from "@/lib/ordre-pdf";
import { isoDag } from "@/lib/perioder";
import { AKTIVE_INTERN, INTERN_STATUS, PERIODER, findInternStatus, periodeFra } from "@/lib/intern";
import { skiftInternStatus } from "@/app/actions/intern";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Klar til intern salg. Godkendte ordrer, som intern salg bestiller hos
 * leverandøren. "Aktive" er alt fra Pending til Klar til kunde; leverede og
 * afsluttede ligger i deres egen pulje med datofilter.
 */
export default async function InternSide({
  searchParams,
}: {
  searchParams: Promise<{ pulje?: string; status?: string; periode?: string; fra?: string; til?: string; q?: string }>;
}) {
  const mig = await kraevBruger();
  if (!mig.ret.intern && !kanLaese(mig.ret.salg)) redirect("/ingen-adgang");
  const styr = mig.ret.intern;
  const { pulje, status, periode, fra, til, q } = await searchParams;
  const afsluttet = pulje === "afsluttet";
  const p = periodeFra(periode, fra, til);
  const soeg = q?.trim() ?? "";
  const nr = Number(soeg.replace(/\D/g, ""));

  const filterSoeg = soeg
    ? {
        OR: [
          { recipientName: { contains: soeg, mode: "insensitive" as const } },
          { leverandoerOrdrenr: { contains: soeg, mode: "insensitive" as const } },
          ...(nr > 0 ? [{ number: nr }] : []),
        ],
      }
    : {};

  const [ordrer, antal] = await Promise.all([
    db.order.findMany({
      where: afsluttet
        ? { internStatus: "afsluttet", internAfsluttetAt: { gte: p.fra, lte: p.til }, ...filterSoeg }
        : { internStatus: status && AKTIVE_INTERN.includes(status as never) ? status : { in: AKTIVE_INTERN }, ...filterSoeg },
      include: { lines: true, company: { select: { id: true, name: true } }, contract: { select: { subNumber: true } } },
      orderBy: afsluttet ? [{ internAfsluttetAt: "desc" }] : [{ internSentAt: "asc" }],
      take: 500,
    }),
    db.order.groupBy({ by: ["internStatus"], where: { internStatus: { not: null } }, _count: { _all: true } }),
  ]);
  const taelt = (k: string) => antal.find((a) => a.internStatus === k)?._count._all ?? 0;
  const vaerdi = ordrer.reduce((s, o) => s + ordreTotal(o.lines), 0);

  const qs = (x: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const alle = { pulje, status, periode, fra, til, q, ...x };
    for (const [k, v] of Object.entries(alle)) if (v) u.set(k, v);
    return `/intern?${u.toString()}`;
  };

  return (
    <div className="max-w-[1300px] flex flex-col gap-5">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {INTERN_STATUS.map((s) => (
          <Link key={s.key} href={s.key === "afsluttet" ? qs({ pulje: "afsluttet", status: undefined }) : qs({ pulje: undefined, status: s.key })}>
            <StatCard label={s.label} value={tal(taelt(s.key))} sub={s.key === "afsluttet" ? "i alt" : "ordrer"} highlight={s.key === "pending" && taelt("pending") > 0} />
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />Klar til intern salg</span>}
          description={afsluttet
            ? `Leveret og afsluttet ${datoKort(p.fra)} – ${datoKort(p.til)} · ${tal(ordrer.length)} ordrer · ${kroner(vaerdi)}`
            : "Godkendte ordrer der skal bestilles hos leverandøren. Ældste øverst."}
          action={
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <Link href="/intern" className={cn("px-3 py-1.5", !afsluttet ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>Aktive</Link>
              <Link href="/intern?pulje=afsluttet" className={cn("px-3 py-1.5", afsluttet ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}>Leveret &amp; afsluttet</Link>
            </div>
          }
        />
        <CardBody className="flex flex-col gap-3 border-b border-border">
          <form className="flex flex-wrap items-center gap-2">
            {afsluttet && <input type="hidden" name="pulje" value="afsluttet" />}
            {afsluttet ? (
              <>
                <div className="flex flex-wrap gap-1">
                  {PERIODER.filter((x) => x.key !== "egen").map((x) => (
                    <Link key={x.key} href={qs({ periode: x.key, fra: undefined, til: undefined })} className={cn("h-8 px-2.5 inline-flex items-center rounded-md border text-xs", p.key === x.key ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-secondary")}>{x.label}</Link>
                  ))}
                </div>
                <input type="hidden" name="periode" value="egen" />
                <Input type="date" name="fra" defaultValue={isoDag(p.fra)} aria-label="Fra" className="h-8 w-36 text-xs" />
                <span className="text-xs text-muted-foreground">til</span>
                <Input type="date" name="til" defaultValue={isoDag(p.til)} aria-label="Til" className="h-8 w-36 text-xs" />
              </>
            ) : (
              <div className="flex flex-wrap gap-1">
                <Link href={qs({ status: undefined })} className={cn("h-8 px-2.5 inline-flex items-center rounded-md border text-xs", !status ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-secondary")}>Alle aktive</Link>
                {INTERN_STATUS.filter((s) => s.key !== "afsluttet").map((s) => (
                  <Link key={s.key} href={qs({ status: s.key })} className={cn("h-8 px-2.5 inline-flex items-center rounded-md border text-xs", status === s.key ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-secondary")}>{s.label}</Link>
                ))}
              </div>
            )}
            <Input type="search" name="q" defaultValue={soeg} placeholder="Kunde, ORD- eller leverandørnr." className="h-8 w-56 text-xs ml-auto" />
            <Button size="sm" variant="secondary" type="submit">Vis</Button>
          </form>
        </CardBody>
        <CardBody className="p-0">
          {ordrer.length === 0 ? (
            <div className="px-5"><EmptyState title={afsluttet ? "Ingen leverede ordrer i perioden" : "Ingen ordrer venter"} icon={ClipboardCheck} description={afsluttet ? "Vælg en anden periode." : "Ordrer sendes hertil fra ordrebekræftelsen med \"Send til intern salg\"."} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Ordre</th>
                    <th className="px-3 py-2.5 font-medium">Kunde</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">{afsluttet ? "Afsluttet" : "Sendt"}</th>
                    <th className="px-3 py-2.5 font-medium">Ansvarlig</th>
                    <th className="px-3 py-2.5 font-medium">Lev. ordrenr.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Beløb</th>
                    {styr && !afsluttet && <th className="px-5 py-2.5 font-medium text-right">Næste trin</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ordrer.map((o) => {
                    const st = findInternStatus(o.internStatus);
                    const i = INTERN_STATUS.findIndex((s) => s.key === o.internStatus);
                    const naeste = INTERN_STATUS[i + 1];
                    return (
                      <tr key={o.id} className="hover:bg-primary/[0.04]">
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          <Link href={`/ordrer/${o.id}#intern`} className="font-medium tabular hover:text-primary">{dokNr(o)}</Link>
                          {o.contract && <span className="ml-2 text-xs text-muted-foreground tabular">{subNr(o.contract.subNumber)}</span>}
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]">{o.company ? <Link href={`/kunder/${o.company.id}`} className="hover:text-primary">{o.company.name}</Link> : o.recipientName}</td>
                        <td className="px-3 py-2.5">{st && <Badge variant={st.variant}>{st.label}</Badge>}</td>
                        <td className="px-3 py-2.5 tabular text-muted-foreground whitespace-nowrap">{datoKort(afsluttet ? o.internAfsluttetAt : o.internSentAt)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{o.internAnsvarlig ?? "–"}</td>
                        <td className="px-3 py-2.5 tabular text-muted-foreground">{o.leverandoerOrdrenr ?? "–"}</td>
                        <td className="px-3 py-2.5 text-right tabular font-medium whitespace-nowrap">{kroner(ordreTotal(o.lines))}</td>
                        {styr && !afsluttet && (
                          <td className="px-5 py-2 text-right">
                            {naeste && (
                              <form action={skiftInternStatus.bind(null, o.id, naeste.key)}>
                                <Button size="sm" variant="secondary" type="submit" className="h-7 text-xs">→ {naeste.kort}</Button>
                              </form>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
