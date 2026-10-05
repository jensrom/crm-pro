import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, FileBadge } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GruppeFlueben } from "@/components/dokumenter/GruppeFlueben";
import { db } from "@/lib/db";
import { foreslaaPeriode, isoDato, sikrSubNumre, subNr } from "@/lib/dokumenter";
import { licensmodel } from "@/lib/katalog";
import { label, FAKTURERING } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Vælg hvilke licenser der skal med på beviset, og ret perioden hvis forslaget
 * ikke passer. ?produkt=<id> forvælger ét produkt, ?linje=<id> én licenslinje.
 */
export default async function LicensbevisSide({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ produkt?: string; linje?: string }>;
}) {
  const { id } = await params;
  const { produkt, linje } = await searchParams;

  await sikrSubNumre(id);
  const kunde = await db.company.findUnique({
    where: { id },
    include: {
      customerProducts: {
        where: { isActive: true },
        include: { product: { include: { family: true } } },
        orderBy: { subNumber: "asc" },
      },
    },
  });
  if (!kunde) notFound();

  // Gruppér linjerne under deres produkt
  const grupper = new Map<string, { navn: string; sortering: number; linjer: typeof kunde.customerProducts }>();
  for (const l of kunde.customerProducts) {
    const fid = l.product.family?.id ?? "uden";
    const g = grupper.get(fid) ?? { navn: l.product.family?.name ?? "Uden produkt", sortering: l.product.family?.sortOrder ?? 999, linjer: [] };
    g.linjer.push(l);
    grupper.set(fid, g);
  }
  const liste = [...grupper.entries()].sort((a, b) => a[1].sortering - b[1].sortering);

  const forvalgt = (l: (typeof kunde.customerProducts)[number]) =>
    linje ? l.id === linje : produkt ? (l.product.familyId ?? "uden") === produkt : true;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <Link href={`/kunder/${kunde.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {kunde.name}
        </Link>
        <h1 className="mt-1.5 text-xl font-semibold flex items-center gap-2"><FileBadge className="h-5 w-5" /> Licensbevis</h1>
      </div>

      {kunde.customerProducts.length === 0 ? (
        <Card><CardBody><EmptyState title="Kunden har ingen aktive licenser" icon={FileBadge} /></CardBody></Card>
      ) : (
        <form method="get" action="/api/dokumenter/licensbevis" className="flex flex-col gap-5">
          <input type="hidden" name="kunde" value={kunde.id} />
          <Card>
            <CardHeader
              title="Licenser på beviset"
              description="Sæt flueben ved produktet for at tage alle licenserne under det med, eller vælg dem enkeltvis. Perioden er foreslået ud fra startdato og fakturering — ret den, hvis den ikke passer. Tom slutdato = tidsubegrænset."
            />
            <CardBody className="p-0">
              {liste.map(([fid, g]) => (
                <div key={fid} className="border-t border-border first:border-t-0">
                  <label className="flex items-center gap-2.5 px-5 py-2.5 bg-secondary/40 text-sm font-semibold">
                    <GruppeFlueben gruppe={fid} label={`Alle licenser under ${g.navn}`} />
                    <Boxes className="h-4 w-4" /> {g.navn}
                  </label>
                  <ul className="divide-y divide-border">
                    {g.linjer.map((l) => {
                      const per = foreslaaPeriode(l, l.product.licenseModel);
                      return (
                        <li key={l.id} className="px-5 py-3 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_150px_150px] gap-x-3 gap-y-2 items-center">
                          <input
                            type="checkbox"
                            name="linje"
                            value={l.id}
                            data-gruppe={fid}
                            defaultChecked={forvalgt(l)}
                            aria-label={`Medtag ${l.product.name}`}
                            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium flex items-center gap-2">
                              {l.product.name}
                              <Badge variant="muted">{subNr(l.subNumber)}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground tabular">
                              {l.seats} licenser · {licensmodel(l.product.licenseModel).label}
                              {l.product.licenseModel !== "perpetual" && ` · ${label(FAKTURERING, l.billingInterval)}`}
                            </div>
                          </div>
                          <div className="col-start-2 sm:col-start-auto">
                            <Input name={`fra_${l.id}`} type="date" defaultValue={isoDato(per.fra)} aria-label="Fra" className="h-8 text-xs" />
                          </div>
                          <div className="col-start-2 sm:col-start-auto">
                            <Input name={`til_${l.id}`} type="date" defaultValue={isoDato(per.til)} aria-label="Til" className="h-8 text-xs" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="gem" value="1" defaultChecked className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
              Gem en kopi i kundens filboks
            </label>
            <Button type="submit"><FileBadge className="h-4 w-4" /> Hent licensbevis (PDF)</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Licensnumrene (SUB) er faste for hver licenslinje og går igen på alle beviser for linjen.
            Afsenderoplysninger og vilkår rettes under Indstillinger → Dokumenter.
          </p>
        </form>
      )}
    </div>
  );
}
