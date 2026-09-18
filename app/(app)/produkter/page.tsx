import Link from "next/link";
import { Check, Package, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import { kroner, procent, tal } from "@/lib/format";
import { gaeldendeMaanedspris } from "@/lib/pricing";
import { gemProdukt, opretProdukt } from "@/app/actions/produkter";
import { flytFlereLinjer } from "@/app/actions/produkter";
import { skiftPakke } from "@/app/actions/kunder";
import { BatchFlyt } from "@/components/produkter/BatchFlyt";
import { StilVaelger } from "@/components/produkter/StilVaelger";
import { ProduktMaerke, ProduktNavn } from "@/lib/produktstil";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BESKEDER: Record<string, string> = {
  flyttet: "Kunderne er flyttet til produktet.",
};

export default async function ProdukterSide({
  searchParams,
}: {
  searchParams: Promise<{ pakke?: string; besked?: string; ny?: string }>;
}) {
  const { pakke, besked, ny } = await searchParams;

  const produkter = await db.product.findMany({
    include: {
      customerProducts: {
        include: { company: { select: { id: true, name: true, country: true } } },
      },
      _count: { select: { deals: true } },
    },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });

  const opretter = ny === "1";
  const valgt = opretter ? null : produkter.find((p) => p.id === pakke) ?? produkter[0];

  const alleLinjer = produkter.flatMap((p) => p.customerProducts.map((l) => ({ ...l, produkt: p })));
  const samletLicenser = alleLinjer.reduce((s, l) => s + l.seats, 0);
  const samletVaerdi = alleLinjer.reduce((s, l) => {
    const pris = gaeldendeMaanedspris(l.unitPriceMonth, l.produkt);
    return s + (pris == null ? 0 : l.seats * pris * 12);
  }, 0);
  const udenPris = alleLinjer.filter((l) => gaeldendeMaanedspris(l.unitPriceMonth, l.produkt) == null).length;

  return (
    <div className="max-w-[1400px] flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-info/40 bg-info/[0.05]">
          <CardBody className="text-sm">{BESKEDER[besked]}</CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produkter" value={tal(produkter.filter((p) => p.isActive).length)} sub={`${produkter.filter((p) => !p.isActive).length} arkiveret`} />
        <StatCard label="Licenser i alt" value={tal(samletLicenser)} sub="på tværs af produkter" />
        <StatCard label="Årlig licensværdi" value={kroner(samletVaerdi)} sub="nuværende licenser" highlight />
        <StatCard label="Linjer uden pris" value={tal(udenPris)} sub={udenPris ? "tæller ikke med i værdien" : "alt er prissat"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
        {/* Venstre: produktlisten */}
        <div className="flex flex-col gap-3">
          {produkter.map((p) => {
            const licenser = p.customerProducts.reduce((s, l) => s + l.seats, 0);
            const aktiv = !opretter && p.id === valgt?.id;
            return (
              <Link
                key={p.id}
                href={`/produkter?pakke=${p.id}`}
                className={cn(
                  "block rounded-xl border px-4 py-3.5 transition-colors",
                  aktiv ? "border-primary bg-primary/[0.06]" : "border-border bg-card hover:bg-secondary/60",
                  !p.isActive && "opacity-60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("flex items-center gap-2 min-w-0 text-sm font-semibold", aktiv && "text-primary")}>
                    <ProduktMaerke icon={p.icon} color={p.color} size="md" />
                    <span className="truncate">{p.name}</span>
                  </span>
                  {aktiv && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <div className="mt-1 text-xs text-muted-foreground tabular">
                  {p.pricePerUserMonth != null ? `${kroner(p.pricePerUserMonth)} pr. bruger/md.` : "ingen pris sat"}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground tabular">
                  <span>{p.customerProducts.length} kunder</span>
                  <span>·</span>
                  <span>{licenser} licenser</span>
                  {!p.isActive && <Badge variant="muted">Arkiveret</Badge>}
                </div>
              </Link>
            );
          })}

          <Link
            href="/produkter?ny=1"
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition-colors",
              opretter ? "border-primary text-primary bg-primary/[0.06]" : "border-border text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <Plus className="h-4 w-4" /> Nyt produkt
          </Link>
        </div>

        {/* Højre: opret eller rediger */}
        <div className="flex flex-col gap-5">
          {opretter ? (
            <Card>
              <CardHeader title="Nyt produkt" description="Navn og pris er det eneste der skal til. Resten kan du udfylde senere." />
              <CardBody>
                <form action={opretProdukt} className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><Label htmlFor="n">Navn</Label><Input id="n" name="name" required placeholder="fx Enterprise" /></div>
                  <div><Label htmlFor="pr">Pris pr. bruger/md. (kr.)</Label><Input id="pr" name="pricePerUserMonth" inputMode="decimal" placeholder="fx 895" /></div>
                  <div><Label htmlFor="sk">Varenummer</Label><Input id="sk" name="sku" placeholder="valgfrit" /></div>
                  <div><Label htmlFor="ti">Nøgle</Label><Input id="ti" name="tier" placeholder="fx enterprise" /></div>
                  <div><Label htmlFor="so">Sortering</Label><Input id="so" name="sortOrder" type="number" placeholder="rækkefølge i listen" /></div>
                  <div className="sm:col-span-2"><Label htmlFor="de">Beskrivelse</Label><Textarea id="de" name="description" className="min-h-[70px]" /></div>
                  <div className="sm:col-span-2 border-t border-border pt-4"><StilVaelger /></div>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <Link href="/produkter"><Button variant="secondary" type="button">Fortryd</Button></Link>
                    <Button type="submit">Opret produkt</Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          ) : !valgt ? (
            <Card>
              <CardBody>
                <EmptyState title="Ingen produkter endnu" icon={Package} description="Opret det første med knappen til venstre." />
              </CardBody>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={<span className="flex items-center gap-2"><ProduktMaerke icon={valgt.icon} color={valgt.color} size="md" />Rediger {valgt.name}</span>}
                  description="Navn, pris, mærke og farve er dit at bestemme."
                />
                <CardBody>
                  <form action={gemProdukt.bind(null, valgt.id)} className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2"><Label htmlFor="en">Navn</Label><Input id="en" name="name" defaultValue={valgt.name} required /></div>
                    <div><Label htmlFor="epr">Pris pr. bruger/md. (kr.)</Label><Input id="epr" name="pricePerUserMonth" inputMode="decimal" defaultValue={valgt.pricePerUserMonth ?? ""} placeholder="tom = ingen pris" /></div>
                    <div><Label htmlFor="esk">Varenummer</Label><Input id="esk" name="sku" defaultValue={valgt.sku ?? ""} /></div>
                    <div><Label htmlFor="eti">Nøgle</Label><Input id="eti" name="tier" defaultValue={valgt.tier} /></div>
                    <div><Label htmlFor="eso">Sortering</Label><Input id="eso" name="sortOrder" type="number" defaultValue={valgt.sortOrder} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="ede">Beskrivelse</Label><Textarea id="ede" name="description" defaultValue={valgt.description ?? ""} className="min-h-[70px]" /></div>
                    <div className="sm:col-span-2 border-t border-border pt-4"><StilVaelger valgtIkon={valgt.icon} valgtFarve={valgt.color} /></div>
                    <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" name="isActive" defaultChecked={valgt.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                      Aktivt — vises når du vælger pakke på en kunde eller en sag
                    </label>
                    <div className="sm:col-span-2 flex justify-between items-center pt-1">
                      <Link href={`/indstillinger/produkter?slet=${valgt.id}`} className="text-xs text-muted-foreground hover:text-danger underline underline-offset-2">
                        Slet produkt
                      </Link>
                      <div className="flex items-center gap-4">
                        <GemtAf af={valgt.updatedBy} tid={valgt.updatedAt} />
                        <Button type="submit">Gem ændringer</Button>
                      </div>
                    </div>
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Sletning foregår under <Link href="/indstillinger/produkter" className="text-primary hover:underline">Indstillinger → Produkter</Link>,
                      hvor du først bliver bedt om at vælge hvad der skal ske med kundernes licenslinjer.
                    </p>
                  </form>
                </CardBody>
              </Card>

              <ProduktKunder valgt={valgt} produkter={produkter} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Produkt = Awaited<ReturnType<typeof db.product.findMany>> extends (infer T)[] ? T : never;

async function ProduktKunder({ valgt, produkter }: { valgt: any; produkter: any[] }) {
  const rows = [...valgt.customerProducts].sort((a: any, b: any) => b.seats - a.seats);
  const licenser = rows.reduce((s: number, l: any) => s + l.seats, 0);
  const aktive = rows.reduce((s: number, l: any) => s + l.activeSeats, 0);
  const vaerdi = rows.reduce((s: number, l: any) => {
    const pris = gaeldendeMaanedspris(l.unitPriceMonth, valgt);
    return s + (pris == null ? 0 : l.seats * pris * 12);
  }, 0);

  return (
    <>
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Kunder</div><div className="text-xl font-semibold tabular">{tal(rows.length)}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Licenser</div><div className="text-xl font-semibold tabular">{tal(licenser)}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Udnyttelse</div><div className="text-xl font-semibold tabular">{procent(licenser ? aktive / licenser : null, 1)}</div></div>
          <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Årsværdi</div><div className="text-xl font-semibold tabular">{vaerdi > 0 ? kroner(vaerdi) : "–"}</div></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Kunder på dette produkt"
          description="Sæt flueben og flyt flere på én gang med bjælken nederst, eller flyt en enkelt i dens egen dropdown. Antal licenser rettes på kundens egen side."
        />
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="Ingen kunder på produktet" icon={Package} description="Vælg produktet på en kunde for at flytte den herover." />
          ) : (
            <BatchFlyt
              action={flytFlereLinjer}
              nuvaerende={valgt.id}
              produkter={produkter.filter((p: any) => p.isActive).map((p: any) => ({ id: p.id, name: p.name }))}
            >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="pl-5 pr-2 py-2.5 font-medium w-9"><span className="sr-only">Vælg</span></th>
                    <th className="px-3 py-2.5 font-medium">Kunde</th>
                    <th className="px-3 py-2.5 font-medium">Land</th>
                    <th className="px-3 py-2.5 font-medium text-right">Licenser</th>
                    <th className="px-3 py-2.5 font-medium text-right">Aktive</th>
                    <th className="px-3 py-2.5 font-medium text-right">Årsværdi</th>
                    <th className="px-5 py-2.5 font-medium">Flyt til produkt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((l: any) => {
                    const pris = gaeldendeMaanedspris(l.unitPriceMonth, valgt);
                    const aarsvaerdi = pris == null ? null : l.seats * pris * 12;
                    return (
                      <tr key={l.id} className="hover:bg-secondary/60">
                        <td className="pl-5 pr-2 py-2.5">
                          <input
                            type="checkbox"
                            name="linjeId"
                            value={l.id}
                            aria-label={`Vælg ${l.company.name}`}
                            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/kunder/${l.company.id}`} className="font-medium hover:text-primary">{l.company.name}</Link>
                          {l.unitPriceMonth != null && <Badge variant="info" className="ml-2">Aftalt pris</Badge>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{l.company.country}</td>
                        <td className="px-3 py-2.5 text-right tabular">{l.seats}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular", l.activeSeats >= l.seats && "text-danger font-semibold")}>{l.activeSeats}</td>
                        <td className="px-3 py-2.5 text-right tabular">{aarsvaerdi == null ? "–" : kroner(aarsvaerdi)}</td>
                        <td className="px-5 py-2">
                          <form
                            action={async (fd: FormData) => {
                              "use server";
                              const nyt = fd.get("productId");
                              if (typeof nyt === "string" && nyt && nyt !== valgt.id) await skiftPakke(l.id, nyt);
                            }}
                            className="flex items-center gap-2"
                          >
                            <Select name="productId" defaultValue={valgt.id} aria-label={`Flyt ${l.company.name}`} className="w-44 h-8 text-xs">
                              {produkter.filter((p) => p.isActive || p.id === valgt.id).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </Select>
                            <Button size="sm" variant="secondary" type="submit">Flyt</Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </BatchFlyt>
          )}
        </CardBody>
      </Card>
    </>
  );
}
