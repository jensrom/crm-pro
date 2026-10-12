import Link from "next/link";
import { ArrowRight, Inbox, Plus, X } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { LicensOptions } from "@/components/produkter/LicensOptions";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { licensGrupper } from "@/lib/katalog";
import { dageSiden, sagsVaerdi } from "@/lib/pipeline";
import { flytStadie, opretSag } from "@/app/actions/salg";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Leads: henvendelser og idéer der endnu ikke er kvalificeret.
 * Teknisk er et lead en salgsmulighed i stadiet "ny" — kvalificeres den,
 * rykker den over i Opportunities med hele sin historik.
 */
export default async function LeadsSide() {
  const nu = new Date();
  const [leads, kunder, grupper, kvalificeret30] = await Promise.all([
    db.deal.findMany({
      where: { stage: "ny" },
      include: { company: { select: { id: true, name: true } }, product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    licensGrupper(),
    db.logEntry.count({
      where: { kind: "salg", content: { contains: "Lead → Kvalificeret" }, createdAt: { gte: new Date(nu.getTime() - 30 * 86_400_000) } },
    }),
  ]);

  const samlet = leads.reduce((s, d) => s + (sagsVaerdi(d) ?? 0), 0);
  const gamle = leads.filter((d) => (dageSiden(d.createdAt, nu) ?? 0) > 30).length;

  return (
    <div className="max-w-[1300px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Åbne leads" value={tal(leads.length)} sub={`på ${tal(new Set(leads.map((l) => l.companyId)).size)} kunder`} />
        <StatCard label="Mulig årsværdi" value={samlet > 0 ? kroner(samlet) : "–"} sub="hvis alle blev til noget" />
        <StatCard label="Kvalificeret" value={tal(kvalificeret30)} sub="seneste 30 dage" highlight />
        <StatCard label="Ældre end 30 dage" value={tal(gamle)} sub={gamle ? "kvalificér eller afvis" : "intet hænger"} />
      </div>

      <Card>
        <CardHeader
          title="Leads"
          description="Kvalificér et lead, når der er et reelt behov og en kontakt — så flytter det over i Opportunities. Afviste leads lukkes som tabt."
          action={<Link href="/opportunities" className="text-xs font-medium text-primary hover:underline">Til opportunities</Link>}
        />
        <CardBody className="p-0">
          {leads.length === 0 ? (
            <div className="px-5"><EmptyState title="Ingen åbne leads" icon={Inbox} description="Opret et nedenfor, eller fra kundens Salg-fane." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Kunde</th>
                    <th className="px-3 py-2.5 font-medium">Lead</th>
                    <th className="px-3 py-2.5 font-medium">Pakke</th>
                    <th className="px-3 py-2.5 font-medium text-right">Licenser</th>
                    <th className="px-3 py-2.5 font-medium text-right">Årsværdi</th>
                    <th className="px-3 py-2.5 font-medium text-right">Alder</th>
                    <th className="px-5 py-2.5 font-medium text-right">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((d) => {
                    const alder = dageSiden(d.createdAt, nu) ?? 0;
                    const v = sagsVaerdi(d);
                    return (
                      <tr key={d.id} className="border-b border-border/60 last:border-0 even:bg-muted/45 hover:bg-primary/[0.05] transition-colors">
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          <Link href={`/kunder/${d.company.id}?fane=salg`} className="font-medium hover:text-primary">{d.company.name}</Link>
                        </td>
                        <td className="px-3 py-2.5 min-w-[220px]">
                          <div>{d.title}</div>
                          {d.nextStep && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <ArrowRight className="h-3 w-3 text-primary" /> {d.nextStep}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{d.product?.name ?? "–"}</td>
                        <td className="px-3 py-2.5 text-right tabular">{d.seatDelta ?? "–"}</td>
                        <td className="px-3 py-2.5 text-right tabular">{v != null ? kroner(v) : "–"}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular whitespace-nowrap", alder > 30 ? "text-warning font-medium" : "text-muted-foreground")} title={`Oprettet ${datoKort(d.createdAt)}`}>
                          {alder === 0 ? "i dag" : `${alder} d.`}
                        </td>
                        <td className="px-5 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <form action={flytStadie.bind(null, d.id, "kvalificeret")}>
                              <Button type="submit" size="sm" variant="secondary" className="h-7 px-2.5 text-xs">
                                Kvalificér <ArrowRight className="h-3 w-3" />
                              </Button>
                            </form>
                            <form action={flytStadie.bind(null, d.id, "tabt")}>
                              <button type="submit" title="Afvis — lukkes som tabt" aria-label={`Afvis ${d.title}`} className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-danger hover:bg-secondary">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </form>
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

      <Card>
        <CardHeader title="Nyt lead" description="Kun titel og kunde er påkrævet. Resten kan udfyldes, når du kvalificerer." />
        <CardBody>
          <form action={opretSag} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <input type="hidden" name="stage" value="ny" />
            <div className="sm:col-span-2">
              <Label htmlFor="lc">Kunde</Label>
              <Select id="lc" name="companyId" required defaultValue="">
                <option value="" disabled>Vælg kunde…</option>
                {kunder.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4"><Label htmlFor="lt">Hvad drejer det sig om?</Label><Input id="lt" name="title" required placeholder="fx Spurgte til flere brugere på lageret" /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="lp">Pakke</Label>
              <Select id="lp" name="productId" defaultValue="">
                <option value="">Ingen</option>
                <LicensOptions grupper={grupper} />
              </Select>
            </div>
            <div><Label htmlFor="ll">Licenser</Label><Input id="ll" name="seatDelta" type="number" min={0} /></div>
            <div className="sm:col-span-2 lg:col-span-2"><Label htmlFor="ln">Næste skridt</Label><Input id="ln" name="nextStep" placeholder="fx Ring til driftschef" /></div>
            <div className="flex justify-end"><Button type="submit"><Plus className="h-3.5 w-3.5" /> Opret lead</Button></div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
