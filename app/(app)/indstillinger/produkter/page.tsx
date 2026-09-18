import Link from "next/link";
import { AlertTriangle, Package, Pencil, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { db } from "@/lib/db";
import { kroner, tal } from "@/lib/format";
import { ProduktMaerke } from "@/lib/produktstil";
import { sletProduktEndeligt, skiftAktiv } from "@/app/actions/produkter";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  "vaelg-handling": "Du skal vælge hvad der skal ske med kundernes licenslinjer, før produktet kan slettes.",
  "ukendt-maal": "Det produkt du valgte at flytte kunderne til findes ikke længere.",
  "findes-ikke": "Produktet findes ikke længere.",
};

export default async function ProduktIndstillinger({
  searchParams,
}: {
  searchParams: Promise<{ slet?: string; besked?: string; navn?: string; fejl?: string }>;
}) {
  const { slet, besked, navn, fejl } = await searchParams;

  const produkter = await db.product.findMany({
    include: { _count: { select: { customerProducts: true, deals: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });

  const tilSletning = slet ? produkter.find((p) => p.id === slet) : null;
  const andre = produkter.filter((p) => p.id !== tilSletning?.id);

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      {besked === "slettet" && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">
            {navn ? `“${decodeURIComponent(navn)}” er slettet.` : "Produktet er slettet."}
          </CardBody>
        </Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            {FEJL[fejl]}
          </CardBody>
        </Card>
      )}

      {tilSletning && (
        <Card className="border-danger/50">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-danger">
                <Trash2 className="h-4 w-4" />
                Slet “{tilSletning.name}”
              </span>
            }
            description="Handlingen kan ikke fortrydes."
          />
          <CardBody>
            <form action={sletProduktEndeligt.bind(null, tilSletning.id)} className="flex flex-col gap-4">
              <div className="text-sm flex flex-col gap-1.5">
                <p>
                  <b>{tal(tilSletning._count.customerProducts)}</b> kunder har dette produkt, og{" "}
                  <b>{tal(tilSletning._count.deals)}</b> salgsmuligheder peger på det.
                </p>
                {tilSletning._count.deals > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sagerne bliver stående — de mister blot produktreferencen og skal have valgt et nyt produkt.
                  </p>
                )}
              </div>

              {tilSletning._count.customerProducts > 0 ? (
                <div className="rounded-lg border border-border p-4 flex flex-col gap-3.5 bg-secondary/40">
                  <p className="text-sm font-medium">Hvad skal der ske med kundernes licenslinjer?</p>

                  <div>
                    <Label htmlFor="flytTil">Flyt dem til et andet produkt</Label>
                    <Select id="flytTil" name="flytTil" defaultValue="" className="max-w-xs">
                      <option value="">Vælg produkt…</option>
                      {andre.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.pricePerUserMonth != null ? ` — ${p.pricePerUserMonth} kr.` : " — ingen pris"}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Antal licenser og aftalte priser følger med. Det er den sikre vej.
                    </p>
                  </div>

                  <div className="border-t border-border pt-3">
                    <label className="flex items-start gap-2.5 text-sm">
                      <input type="checkbox" name="sletLinjer" className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--destructive))]" />
                      <span>
                        Slet licenslinjerne sammen med produktet
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          De {tal(tilSletning._count.customerProducts)} kunder mister registreringen af hvor mange
                          licenser de har. Kunderne selv, deres kontakter og historik berøres ikke.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ingen kunder bruger produktet, så der er intet at flytte.
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Link href="/indstillinger/produkter"><Button variant="secondary" type="button">Fortryd</Button></Link>
                <Button variant="danger" type="submit">Slet produktet</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Produkter"
          description="Alt om priser, mærker og navne redigerer du under Produkter. Her sletter du dem."
          action={<Link href="/produkter" className="text-xs font-medium text-primary hover:underline">Rediger produkter</Link>}
        />
        <CardBody className="p-0">
          {produkter.length === 0 ? (
            <EmptyState title="Ingen produkter" icon={Package} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Produkt</th>
                    <th className="px-3 py-2.5 font-medium text-right">Pris/bruger/md.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Kunder</th>
                    <th className="px-3 py-2.5 font-medium text-right">Sager</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium text-right">Handling</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {produkter.map((p) => (
                    <tr key={p.id} className={cn("hover:bg-secondary/60", !p.isActive && "opacity-60")}>
                      <td className="px-5 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <ProduktMaerke icon={p.icon} color={p.color} size="sm" />
                          <span className="font-medium">{p.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">
                        {p.pricePerUserMonth != null ? kroner(p.pricePerUserMonth) : "–"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{tal(p._count.customerProducts)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{tal(p._count.deals)}</td>
                      <td className="px-3 py-2.5">
                        {p.isActive ? <Badge variant="success">Aktivt</Badge> : <Badge variant="muted">Arkiveret</Badge>}
                      </td>
                      <td className="px-5 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/produkter?pakke=${p.id}`} title="Rediger">
                            <Button size="sm" variant="ghost" type="button" className="px-2">
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Rediger {p.name}</span>
                            </Button>
                          </Link>
                          <form action={async () => { "use server"; await skiftAktiv(p.id, !p.isActive); }}>
                            <Button size="sm" variant="ghost" type="submit" className="text-xs px-2">
                              {p.isActive ? "Arkivér" : "Genaktivér"}
                            </Button>
                          </form>
                          <Link href={`/indstillinger/produkter?slet=${p.id}`} title="Slet">
                            <Button size="sm" variant="ghost" type="button" className="px-2 text-danger hover:bg-danger/10">
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Slet {p.name}</span>
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-muted-foreground max-w-prose">
        <b>Arkivér</b> skjuler produktet fra dropdowns, men beholder historikken for de kunder der har haft det.
        <b className="ml-1">Slet</b> fjerner det helt, og du bliver bedt om at vælge hvad der skal ske med kundernes
        licenslinjer først.
      </p>
    </div>
  );
}
