import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { kroner, tal } from "@/lib/format";
import { subNr } from "@/lib/dokumenter";
import { aftaleUdloeb, dagTekst, plusDage } from "@/lib/perioder";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VINDUER = [30, 60, 90, 180, 365];

/** Aftaler der udløber inden for den valgte horisont — med genvej til fornyelsen. */
export default async function FornyelserSide({ searchParams }: { searchParams: Promise<{ dage?: string }> }) {
  const { dage } = await searchParams;
  const vindue = VINDUER.includes(Number(dage)) ? Number(dage) : 90;
  const nu = new Date();
  const graense = plusDage(nu, vindue);

  const linjer = await db.customerProduct.findMany({
    where: { isActive: true, company: { isActive: true }, product: { licenseModel: { not: "perpetual" } } },
    include: { company: { select: { id: true, name: true } }, product: { include: { family: true } } },
  });

  const raekker = linjer
    .map((l) => ({ l, udloeb: aftaleUdloeb(l, nu) }))
    .filter((r) => r.udloeb <= graense)
    .sort((a, b) => a.udloeb.getTime() - b.udloeb.getTime());

  const aarsvaerdi = raekker.reduce((s, { l }) => {
    const pris = l.unitPriceMonth ?? l.product.pricePerUserMonth;
    return s + (pris == null ? 0 : l.seats * pris * 12);
  }, 0);
  const kunder = new Set(raekker.map((r) => r.l.companyId)).size;

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Aftaler til fornyelse" value={tal(raekker.length)} sub={`inden for ${vindue} dage`} />
        <StatCard label="Kunder" value={tal(kunder)} sub="med mindst én aftale" />
        <StatCard label="Årsværdi på spil" value={kroner(aarsvaerdi)} sub="nuværende licenser × pris × 12" highlight />
      </div>

      <Card>
        <CardHeader
          title="Fornyelser"
          description="Udløb er aftalens slutdato — eller beregnet ud fra startdato og aftaleperiode, hvis den ikke er sat."
          action={
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {VINDUER.map((v) => (
                <Link key={v} href={`/fornyelser?dage=${v}`} className={v === vindue ? "px-2.5 py-1 bg-primary text-primary-foreground" : "px-2.5 py-1 hover:bg-secondary"}>
                  {v} dage
                </Link>
              ))}
            </div>
          }
        />
        <CardBody className="p-0">
          {raekker.length === 0 ? (
            <div className="px-5"><EmptyState title="Ingen aftaler udløber i perioden" icon={RefreshCw} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Udløber</th>
                    <th className="px-3 py-2.5 font-medium">Kunde</th>
                    <th className="px-3 py-2.5 font-medium">Licens</th>
                    <th className="px-3 py-2.5 font-medium text-right">Licenser</th>
                    <th className="px-3 py-2.5 font-medium text-right">Aftale</th>
                    <th className="px-5 py-2.5 font-medium text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {raekker.map(({ l, udloeb }) => {
                    const dageTil = Math.round((udloeb.getTime() - nu.getTime()) / 86_400_000);
                    return (
                      <tr key={l.id} className="hover:bg-secondary/60">
                        <td className="px-5 py-2.5 tabular">
                          <span className={cn(dageTil < 0 ? "text-danger font-medium" : dageTil <= 30 ? "text-warning font-medium" : "")}>{dagTekst(udloeb)}</span>
                          <div className="text-xs text-muted-foreground">{dageTil < 0 ? `udløbet for ${-dageTil} dage siden` : `om ${dageTil} dage`}</div>
                        </td>
                        <td className="px-3 py-2.5"><Link href={`/kunder/${l.company.id}`} className="font-medium hover:text-primary">{l.company.name}</Link></td>
                        <td className="px-3 py-2.5">
                          {l.product.family && !l.product.name.toLowerCase().startsWith(l.product.family.name.toLowerCase()) ? `${l.product.family.name} · ` : ""}{l.product.name}
                          <Badge variant="muted" className="ml-2">{subNr(l.subNumber)}</Badge>
                          {!l.endDate && <Badge variant="muted" className="ml-1">beregnet</Badge>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">{l.seats}</td>
                        <td className="px-3 py-2.5 text-right tabular">{l.termMonths} mdr.</td>
                        <td className="px-5 py-2">
                          <div className="flex justify-end gap-1.5">
                            <Link href={`/ordrer/ny?type=tilbud&kunde=${l.companyId}&forny=${l.id}`}><Button size="sm" variant="ghost">Tilbud</Button></Link>
                            <Link href={`/ordrer/ny?type=ordre&kunde=${l.companyId}&forny=${l.id}`}><Button size="sm" variant="secondary"><RefreshCw className="h-3.5 w-3.5" /> Lav fornyelse</Button></Link>
                          </div>
                        </td>
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
