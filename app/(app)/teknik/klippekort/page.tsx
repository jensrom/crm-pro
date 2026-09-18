import Link from "next/link";
import { Scissors, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { kortnummer, kortstatus, varighed } from "@/lib/teknik";
import { gemKlippekort, opretKlippekort, sletKlippekort } from "@/app/actions/teknik";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function KlippekortSide({
  searchParams,
}: {
  searchParams: Promise<{ rediger?: string }>;
}) {
  const { rediger } = await searchParams;

  const [kort, kunder] = await Promise.all([
    db.hourBundle.findMany({
      include: { company: { select: { id: true, name: true } }, _count: { select: { timeLogs: true } } },
      orderBy: [{ isActive: "desc" }, { number: "desc" }],
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const nu = new Date();
  const status = kort.map((k) => ({ k, s: kortstatus(k, nu) }));
  const aktive = status.filter(({ k, s }) => k.isActive && !s.udloebet);
  const restSum = aktive.reduce((sum, { s }) => sum + Math.max(0, s.restMin), 0);
  const koebtSum = status.reduce((sum, { s }) => sum + s.koebteMin, 0);
  const brugtSum = status.reduce((sum, { k }) => sum + k.usedMinutes, 0);
  const advarsler = aktive.filter(({ s }) => s.naestenOpbrugt || s.opbrugt).length;

  const under = rediger ? kort.find((k) => k.id === rediger) : null;

  return (
    <div className="max-w-[1300px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aktive kort" value={tal(aktive.length)} sub={`${tal(kort.length)} i alt`} />
        <StatCard label="Timer solgt" value={varighed(koebtSum)} sub="på alle kort" />
        <StatCard label="Timer brugt" value={varighed(brugtSum)} sub={koebtSum ? `${Math.round((brugtSum / koebtSum) * 100)} % af det solgte` : undefined} />
        <StatCard label="Timer tilbage" value={varighed(restSum)} sub={advarsler ? `${advarsler} kort er ved at være brugt op` : "på aktive kort"} highlight />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
        <Card>
          <CardHeader title="Klippekort" description="Forbruget opdateres automatisk når du registrerer tid på en sag og vælger kortet." />
          <CardBody className="p-0">
            {kort.length === 0 ? (
              <EmptyState title="Ingen klippekort endnu" icon={Scissors} description="Opret det første i formularen ved siden af." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="px-5 py-2.5 font-medium">Kort</th>
                      <th className="px-3 py-2.5 font-medium">Kunde</th>
                      <th className="px-3 py-2.5 font-medium text-right">Solgt</th>
                      <th className="px-3 py-2.5 font-medium text-right">Brugt</th>
                      <th className="px-3 py-2.5 font-medium text-right">Tilbage</th>
                      <th className="px-3 py-2.5 font-medium w-36">Forbrug</th>
                      <th className="px-5 py-2.5 font-medium text-right">Handling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {status.map(({ k, s }) => (
                      <tr key={k.id} className={cn("hover:bg-secondary/60", (!k.isActive || s.udloebet) && "opacity-60")}>
                        <td className="px-5 py-2.5">
                          <div className="font-medium tabular text-xs">{kortnummer(k.number)}</div>
                          {k.name && <div className="text-xs text-muted-foreground">{k.name}</div>}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {!k.isActive && <Badge variant="muted">Inaktivt</Badge>}
                            {s.udloebet && <Badge variant="danger">Udløbet {datoKort(k.expiresAt)}</Badge>}
                            {!s.udloebet && s.opbrugt && <Badge variant="danger">Opbrugt</Badge>}
                            {!s.udloebet && s.naestenOpbrugt && <Badge variant="warning">Snart opbrugt</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/kunder/${k.company.id}`} className="text-muted-foreground hover:text-primary">{k.company.name}</Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular">{varighed(s.koebteMin)}</td>
                        <td className="px-3 py-2.5 text-right tabular">{varighed(k.usedMinutes)}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular font-medium", s.restMin <= 0 && "text-danger")}>{varighed(s.restMin)}</td>
                        <td className="px-3 py-2.5">
                          <div className="h-2 rounded-full bg-secondary overflow-hidden" role="img" aria-label={`${Math.round(s.forbrugt * 100)} procent brugt`}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.max(0, s.forbrugt * 100))}%`,
                                background: s.opbrugt ? "#B91C1C" : s.naestenOpbrugt ? "#B45309" : "#047857",
                              }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground tabular">{Math.round(s.forbrugt * 100)} %</div>
                        </td>
                        <td className="px-5 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/teknik/klippekort?rediger=${k.id}`}>
                              <Button size="sm" variant="ghost" type="button" className="text-xs px-2">Rediger</Button>
                            </Link>
                            <form action={async () => { "use server"; await sletKlippekort(k.id); }}>
                              <button type="submit" aria-label={`Slet ${kortnummer(k.number)}`} className="text-muted-foreground hover:text-danger p-1 rounded">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
                  Sletter du et kort, bliver tidsposterne stående — de mister blot tilknytningen, for timerne er stadig brugt.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={under ? `Rediger ${kortnummer(under.number)}` : "Nyt klippekort"} />
          <CardBody>
            {under ? (
              <form action={gemKlippekort.bind(null, under.id)} className="flex flex-col gap-3.5">
                <div><Label htmlFor="rname">Navn</Label><Input id="rname" name="name" defaultValue={under.name ?? ""} placeholder="fx 20-timers pakke 2026" /></div>
                <div><Label htmlFor="rtotal">Timer solgt</Label><Input id="rtotal" name="totalHours" inputMode="decimal" defaultValue={under.totalHours} required /></div>
                <div><Label htmlFor="rprice">Pris (kr.)</Label><Input id="rprice" name="price" inputMode="decimal" defaultValue={under.price ?? ""} /></div>
                <div><Label htmlFor="rkoeb">Købsdato</Label><Input id="rkoeb" name="purchaseDate" type="date" defaultValue={under.purchaseDate.toISOString().slice(0, 10)} /></div>
                <div><Label htmlFor="rudl">Udløber</Label><Input id="rudl" name="expiresAt" type="date" defaultValue={under.expiresAt ? under.expiresAt.toISOString().slice(0, 10) : ""} /></div>
                <div><Label htmlFor="rnote">Note</Label><Textarea id="rnote" name="notes" defaultValue={under.notes ?? ""} className="min-h-[60px]" /></div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={under.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                  Aktivt
                </label>
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                  <GemtAf af={under.updatedBy} tid={under.updatedAt} className="mr-auto" />
                  <Link href="/teknik/klippekort"><Button variant="secondary" type="button">Fortryd</Button></Link>
                  <Button type="submit">Gem</Button>
                </div>
              </form>
            ) : (
              <form action={opretKlippekort} className="flex flex-col gap-3.5">
                <div>
                  <Label htmlFor="companyId">Kunde</Label>
                  <Select id="companyId" name="companyId" required defaultValue="">
                    <option value="" disabled>Vælg kunde…</option>
                    {kunder.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </Select>
                </div>
                <div><Label htmlFor="name">Navn</Label><Input id="name" name="name" placeholder="fx 20-timers pakke 2026" /></div>
                <div><Label htmlFor="totalHours">Timer solgt</Label><Input id="totalHours" name="totalHours" inputMode="decimal" required placeholder="fx 20" /></div>
                <div><Label htmlFor="price">Pris (kr.)</Label><Input id="price" name="price" inputMode="decimal" /></div>
                <div><Label htmlFor="purchaseDate">Købsdato</Label><Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                <div><Label htmlFor="expiresAt">Udløber</Label><Input id="expiresAt" name="expiresAt" type="date" /></div>
                <div><Label htmlFor="notes">Note</Label><Textarea id="notes" name="notes" className="min-h-[60px]" /></div>
                <div className="flex justify-end"><Button type="submit">Opret kort</Button></div>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
