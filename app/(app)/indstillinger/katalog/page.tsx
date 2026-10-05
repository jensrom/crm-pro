import Link from "next/link";
import { AlertTriangle, Boxes, CalendarClock, Check, Package, Plus, Tag, Trash2, X } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { StilVaelger } from "@/components/produkter/StilVaelger";
import { db } from "@/lib/db";
import { dato, kroner, tal } from "@/lib/format";
import { LICENSMODELLER, licensmodel, listepris } from "@/lib/katalog";
import { ProduktMaerke } from "@/lib/produktstil";
import { cn } from "@/lib/utils";
import {
  aendrPris, annullerPrisaendring, gemLicens, gemProduktFamilie, opretLicens, opretProduktFamilie, sletProduktFamilie,
} from "@/app/actions/katalog";

export const dynamic = "force-dynamic";

const KAT = "/indstillinger/katalog";

const BESKEDER: Record<string, string> = {
  gemt: "Ændringerne er gemt.",
  "produkt-oprettet": "Produktet er oprettet. Læg nu licenserne ind under det.",
  "produkt-slettet": "Produktet er slettet.",
  "licens-oprettet": "Licensen er oprettet.",
  "pris-aendret": "Prisen er ændret og gælder fra nu.",
  "pris-planlagt": "Prisændringen er planlagt og træder i kraft på datoen.",
  "pris-annulleret": "Den planlagte prisændring er annulleret.",
  "licens-slettet": "Licensen er slettet.",
};

const FEJL: Record<string, string> = {
  navn: "Produktet skal have et navn.",
  "licens-mangler": "Licensen skal have et navn og høre under et produkt.",
  "har-licenser": "Produktet har stadig licenser. Flyt eller slet dem først.",
  "findes-ikke": "Licensen findes ikke længere.",
};

function iDag() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function prisTekst(p: { licenseModel: string; pricePerUserMonth: number | null; oneTimePrice: number | null }) {
  const pris = listepris(p);
  if (pris == null) return "ingen pris";
  return `${kroner(pris)} ${licensmodel(p.licenseModel).enhed}`;
}

export default async function KatalogSide({
  searchParams,
}: {
  searchParams: Promise<{ produkt?: string; licens?: string; ny?: string; besked?: string; fejl?: string; model?: string }>;
}) {
  const { produkt, licens, ny, besked, fejl, model } = await searchParams;

  const [familier, uplacerede] = await Promise.all([
    db.productFamily.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        products: {
          orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
          include: { customerProducts: { select: { seats: true } } },
        },
      },
    }),
    db.product.findMany({
      where: { familyId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { customerProducts: { select: { seats: true } } },
    }),
  ]);

  const alleLicenser = [...familier.flatMap((f) => f.products), ...uplacerede];
  const valgtFamilie = produkt ? familier.find((f) => f.id === produkt) ?? null : null;
  const valgtLicens = licens ? alleLicenser.find((l) => l.id === licens) ?? null : null;

  const prishistorik = valgtLicens
    ? await db.productPrice.findMany({ where: { productId: valgtLicens.id }, orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }] })
    : [];

  return (
    <div className="max-w-[1300px] flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">
            {BESKEDER[besked]}
            {model === "skiftet" && " Licensmodellen er skiftet — tjek at prisen stadig passer, og lav en prisændring hvis ikke."}
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

      <div className="grid gap-5 lg:grid-cols-[320px_1fr] items-start">
        {/* Venstre: kataloget som træ — produkt → licenser */}
        <div className="flex flex-col gap-3">
          {familier.map((f) => {
            const aktivF = f.id === valgtFamilie?.id;
            return (
              <div key={f.id} className={cn("rounded-xl border bg-card", aktivF ? "border-primary" : "border-border", !f.isActive && "opacity-60")}>
                <Link
                  href={`${KAT}?produkt=${f.id}`}
                  className={cn("flex items-center justify-between gap-2 px-4 py-3 rounded-t-xl", aktivF ? "bg-primary/[0.06]" : "hover:bg-secondary/60")}
                >
                  <span className={cn("flex items-center gap-2 text-sm font-semibold min-w-0", aktivF && "text-primary")}>
                    <Boxes className="h-4 w-4 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular shrink-0">
                    {f.products.length} {f.products.length === 1 ? "licens" : "licenser"}
                    {!f.isActive && " · arkiveret"}
                  </span>
                </Link>
                <ul className="border-t border-border py-1">
                  {f.products.map((l) => {
                    const aktivL = l.id === valgtLicens?.id;
                    return (
                      <li key={l.id}>
                        <Link
                          href={`${KAT}?licens=${l.id}`}
                          className={cn(
                            "flex items-center justify-between gap-2 pl-6 pr-4 py-1.5 text-sm",
                            aktivL ? "text-primary font-medium bg-primary/[0.06]" : "hover:bg-secondary/60",
                            !l.isActive && "opacity-60"
                          )}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <ProduktMaerke icon={l.icon} color={l.color} size="sm" />
                            <span className="truncate">{l.name}</span>
                          </span>
                          <Badge variant={l.licenseModel === "perpetual" ? "warning" : "muted"} className="shrink-0">
                            {licensmodel(l.licenseModel).kort}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                  <li>
                    <Link
                      href={`${KAT}?ny=licens&produkt=${f.id}`}
                      className="flex items-center gap-1.5 pl-6 pr-4 py-1.5 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" /> Ny licens under {f.name}
                    </Link>
                  </li>
                </ul>
              </div>
            );
          })}

          {uplacerede.length > 0 && (
            <div className="rounded-xl border border-dashed border-warning/60 bg-card">
              <div className="px-4 py-3 text-sm font-semibold text-warning">Uden produkt</div>
              <ul className="border-t border-border py-1">
                {uplacerede.map((l) => (
                  <li key={l.id}>
                    <Link href={`${KAT}?licens=${l.id}`} className="block pl-6 pr-4 py-1.5 text-sm hover:bg-secondary/60">
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`${KAT}?ny=produkt`}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition-colors",
              ny === "produkt" ? "border-primary text-primary bg-primary/[0.06]" : "border-border text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <Plus className="h-4 w-4" /> Nyt produkt
          </Link>
        </div>

        {/* Højre: det valgte */}
        <div className="flex flex-col gap-5">
          {ny === "produkt" ? (
            <NytProdukt />
          ) : ny === "licens" ? (
            <NyLicens familier={familier} valgtFamilieId={produkt ?? familier[0]?.id} />
          ) : valgtLicens ? (
            <>
              <LicensRediger licens={valgtLicens} familier={familier} />
              <Prisaendring licens={valgtLicens} historik={prishistorik} />
            </>
          ) : valgtFamilie ? (
            <ProduktRediger familie={valgtFamilie} />
          ) : (
            <Oversigt familier={familier} />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-prose">
        <b>Produkt</b> er overbegrebet (fx Idus). <b>Licenserne</b> under det er det kunderne har linjer på, og det du
        registrerer tilkøb af. <b>Subscription</b> prissættes pr. bruger pr. måned og tæller med i årsværdien.{" "}
        <b>Perpetual</b> er købt én gang og prissættes pr. licens — den indgår ikke i den løbende årsværdi.
      </p>
    </div>
  );
}

// ---------- Oversigt ----------

type Familie = Awaited<ReturnType<typeof db.productFamily.findMany>>[number] & {
  products: (Awaited<ReturnType<typeof db.product.findMany>>[number] & { customerProducts: { seats: number }[] })[];
};
type Licens = Familie["products"][number];

function Oversigt({ familier }: { familier: Familie[] }) {
  if (familier.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Kataloget er tomt" icon={Package} description="Opret det første produkt med knappen til venstre." />
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Katalog" description="Alle produkter og licenser. Klik på en licens for at rette den eller ændre prisen." />
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-5 py-2.5 font-medium">Licens</th>
                <th className="px-3 py-2.5 font-medium">Model</th>
                <th className="px-3 py-2.5 font-medium text-right">Listepris</th>
                <th className="px-3 py-2.5 font-medium text-right">Kunder</th>
                <th className="px-5 py-2.5 font-medium text-right">Licenser</th>
              </tr>
            </thead>
            {familier.map((f) => (
              <tbody key={f.id} className="divide-y divide-border border-b border-border">
                <tr className="bg-secondary/40">
                  <td colSpan={5} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide">
                    <Link href={`${KAT}?produkt=${f.id}`} className="hover:text-primary">{f.name}</Link>
                    {!f.isActive && <Badge variant="muted" className="ml-2">Arkiveret</Badge>}
                  </td>
                </tr>
                {f.products.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-2.5 text-xs text-muted-foreground">Ingen licenser endnu.</td></tr>
                ) : (
                  f.products.map((l) => (
                    <tr key={l.id} className={cn("hover:bg-secondary/60", !l.isActive && "opacity-60")}>
                      <td className="px-5 py-2.5">
                        <Link href={`${KAT}?licens=${l.id}`} className="inline-flex items-center gap-2 font-medium hover:text-primary">
                          <ProduktMaerke icon={l.icon} color={l.color} size="sm" />
                          {l.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={l.licenseModel === "perpetual" ? "warning" : "muted"}>{licensmodel(l.licenseModel).label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{prisTekst(l)}</td>
                      <td className="px-3 py-2.5 text-right tabular">{tal(l.customerProducts.length)}</td>
                      <td className="px-5 py-2.5 text-right tabular">{tal(l.customerProducts.reduce((s, c) => s + c.seats, 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            ))}
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------- Produkt (familie) ----------

function NytProdukt() {
  return (
    <Card>
      <CardHeader title="Nyt produkt" description="Fx Idus, Fiix eller et andet produkt. Licenserne lægger du ind under det bagefter." />
      <CardBody>
        <form action={opretProduktFamilie} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label htmlFor="fn">Navn</Label><Input id="fn" name="name" required placeholder="fx Idus" /></div>
          <div><Label htmlFor="fs">Sortering</Label><Input id="fs" name="sortOrder" type="number" placeholder="rækkefølge" /></div>
          <div className="sm:col-span-2"><Label htmlFor="fd">Beskrivelse</Label><Textarea id="fd" name="description" className="min-h-[70px]" /></div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Link href={KAT}><Button variant="secondary" type="button">Fortryd</Button></Link>
            <Button type="submit">Opret produkt</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ProduktRediger({ familie }: { familie: Familie }) {
  const kunder = familie.products.reduce((s, l) => s + l.customerProducts.length, 0);
  const licenser = familie.products.reduce((s, l) => s + l.customerProducts.reduce((x, c) => x + c.seats, 0), 0);
  return (
    <>
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Boxes className="h-4 w-4" />{familie.name}</span>}
          description={`${tal(familie.products.length)} licenser · ${tal(kunder)} kundelinjer · ${tal(licenser)} tildelte licenser`}
        />
        <CardBody>
          <form action={gemProduktFamilie.bind(null, familie.id)} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label htmlFor="en">Navn</Label><Input id="en" name="name" defaultValue={familie.name} required /></div>
            <div><Label htmlFor="es">Sortering</Label><Input id="es" name="sortOrder" type="number" defaultValue={familie.sortOrder} /></div>
            <div className="sm:col-span-2"><Label htmlFor="ed">Beskrivelse</Label><Textarea id="ed" name="description" defaultValue={familie.description ?? ""} className="min-h-[70px]" /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="ec">Kommercielle betingelser — én pr. linje, fx &quot;Betaling: 14 dage netto.&quot;</Label>
              <Textarea id="ec" name="commercialTerms" defaultValue={familie.commercialTerms ?? ""} className="min-h-[150px] font-mono text-xs" />
              <p className="text-xs text-muted-foreground mt-1">Står på tilbud og ordrebekræftelser med licenser fra produktet. Linjen &quot;Gyldighed&quot; vises kun på tilbud.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="eg">Generelle betingelser (Terms &amp; Conditions)</Label>
              <Textarea id="eg" name="generalTerms" defaultValue={familie.generalTerms ?? ""} className="min-h-[220px] font-mono text-xs" />
              <p className="text-xs text-muted-foreground mt-1">
                Sættes ind på egne sider bagerst i dokumentet. Punktnumre adskilt med tabulator (&quot;1.1.→tekst&quot;) får hængende indryk.
                {familie.generalTerms ? ` ${tal(familie.generalTerms.length)} tegn.` : ""}
              </p>
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={familie.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
              Aktivt — licenserne kan vælges på kunder og sager
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
              <GemtAf af={familie.updatedBy} tid={familie.updatedAt} className="mr-auto" />
              <Button type="submit">Gem produkt</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Licenser under produktet"
          action={
            <Link href={`${KAT}?ny=licens&produkt=${familie.id}`}>
              <Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Ny licens</Button>
            </Link>
          }
        />
        <CardBody className="p-0">
          {familie.products.length === 0 ? (
            <div className="px-5"><EmptyState title="Ingen licenser" icon={Tag} description="Læg den første licens ind under produktet." /></div>
          ) : (
            <ul className="divide-y divide-border">
              {familie.products.map((l) => (
                <li key={l.id} className={cn("px-5 py-2.5 flex items-center justify-between gap-3", !l.isActive && "opacity-60")}>
                  <Link href={`${KAT}?licens=${l.id}`} className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary min-w-0">
                    <ProduktMaerke icon={l.icon} color={l.color} size="sm" />
                    <span className="truncate">{l.name}</span>
                  </Link>
                  <span className="text-xs text-muted-foreground tabular shrink-0">
                    {licensmodel(l.licenseModel).kort} · {prisTekst(l)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {familie.products.length === 0 && (
        <form action={sletProduktFamilie.bind(null, familie.id)} className="flex justify-end">
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Slet produktet
          </Button>
        </form>
      )}
    </>
  );
}

// ---------- Licens ----------

function ModelValg({ valgt = "sub" }: { valgt?: string }) {
  return (
    <div className="sm:col-span-2">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">Licensmodel</span>
      <div className="grid sm:grid-cols-2 gap-2">
        {LICENSMODELLER.map((m) => (
          <label key={m.key} className="cursor-pointer">
            <input type="radio" name="licenseModel" value={m.key} defaultChecked={m.key === valgt} className="sr-only peer" />
            <span className="flex flex-col rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary/[0.06]">
              <span className="font-medium">{m.label}</span>
              <span className="text-xs text-muted-foreground">
                {m.key === "sub" ? "Abonnement — pris pr. bruger pr. måned" : "Købt én gang — pris pr. licens"}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function NyLicens({ familier, valgtFamilieId }: { familier: Familie[]; valgtFamilieId?: string }) {
  if (familier.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState title="Opret et produkt først" icon={Boxes} description="Licenser skal ligge under et produkt." />
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Ny licens" description="Navn, produkt og pris er nok. Prisen bliver første post i prishistorikken." />
      <CardBody>
        <form action={opretLicens} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label htmlFor="ln">Navn</Label><Input id="ln" name="name" required placeholder="fx Idus Online Professional" /></div>
          <div>
            <Label htmlFor="lf">Produkt</Label>
            <Select id="lf" name="familyId" defaultValue={valgtFamilieId} required>
              {familier.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div><Label htmlFor="lp">Pris (kr.)</Label><Input id="lp" name="price" inputMode="decimal" placeholder="sub: pr. bruger/md. · perpetual: pr. licens" /></div>
          <ModelValg />
          <div><Label htmlFor="lk">Varenummer</Label><Input id="lk" name="sku" placeholder="valgfrit" /></div>
          <div><Label htmlFor="lo">Sortering</Label><Input id="lo" name="sortOrder" type="number" placeholder="rækkefølge under produktet" /></div>
          <div className="sm:col-span-2"><Label htmlFor="ld">Intern beskrivelse</Label><Textarea id="ld" name="description" className="min-h-[60px]" /></div>
          <div className="sm:col-span-2"><Label htmlFor="ldt">Tekst på tilbud og ordrebekræftelser</Label><Textarea id="ldt" name="documentText" className="min-h-[80px]" /></div>
          <div className="sm:col-span-2 border-t border-border pt-4"><StilVaelger /></div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Link href={KAT}><Button variant="secondary" type="button">Fortryd</Button></Link>
            <Button type="submit">Opret licens</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function LicensRediger({ licens, familier }: { licens: Licens; familier: Familie[] }) {
  const kunder = licens.customerProducts.length;
  const seats = licens.customerProducts.reduce((s, c) => s + c.seats, 0);
  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><ProduktMaerke icon={licens.icon} color={licens.color} size="md" />{licens.name}</span>}
        description={`${licensmodel(licens.licenseModel).label} · ${prisTekst(licens)} · ${tal(kunder)} kunder · ${tal(seats)} licenser`}
      />
      <CardBody>
        <form action={gemLicens.bind(null, licens.id)} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label htmlFor="en">Navn</Label><Input id="en" name="name" defaultValue={licens.name} required /></div>
          <div>
            <Label htmlFor="ef">Produkt</Label>
            <Select id="ef" name="familyId" defaultValue={licens.familyId ?? ""}>
              {licens.familyId == null && <option value="">Vælg produkt…</option>}
              {familier.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div><Label htmlFor="ek">Varenummer</Label><Input id="ek" name="sku" defaultValue={licens.sku ?? ""} /></div>
          <ModelValg valgt={licens.licenseModel} />
          <div><Label htmlFor="eo">Sortering</Label><Input id="eo" name="sortOrder" type="number" defaultValue={licens.sortOrder} /></div>
          <div className="sm:col-span-2"><Label htmlFor="ed">Intern beskrivelse</Label><Textarea id="ed" name="description" defaultValue={licens.description ?? ""} className="min-h-[60px]" /></div>
          <div className="sm:col-span-2">
            <Label htmlFor="edt">Tekst på tilbud og ordrebekræftelser</Label>
            <Textarea id="edt" name="documentText" defaultValue={licens.documentText ?? ""} className="min-h-[90px]" placeholder="fx OPC Router 5 – Basic indeholder følgende plugins: OPC UA/Classic Client og SQL Server." />
          </div>
          <div className="sm:col-span-2 border-t border-border pt-4"><StilVaelger valgtIkon={licens.icon} valgtFarve={licens.color} /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={licens.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
            Aktiv — kan vælges på kunder, sager og tilkøb
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <Link href={`/indstillinger/produkter?slet=${licens.id}`} className="mr-auto text-xs text-muted-foreground hover:text-danger underline underline-offset-2">
              Slet licens
            </Link>
            <GemtAf af={licens.updatedBy} tid={licens.updatedAt} />
            <Button type="submit">Gem licens</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

type Pris = Awaited<ReturnType<typeof db.productPrice.findMany>>[number];

function Prisaendring({ licens, historik }: { licens: Licens; historik: Pris[] }) {
  const m = licensmodel(licens.licenseModel);
  const nu = new Date();
  return (
    <Card>
      <CardHeader
        title="Prisændring"
        description={`Nuværende listepris: ${prisTekst(licens)} — kunder med aftalt pris på deres linje berøres ikke.`}
      />
      <CardBody className="flex flex-col gap-5">
        <form action={aendrPris.bind(null, licens.id)} className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label htmlFor="np">Ny pris (kr.)</Label>
            <Input id="np" name="price" inputMode="decimal" required placeholder={m.enhed} />
          </div>
          <div>
            <Label htmlFor="nd">Gælder fra</Label>
            <Input id="nd" name="validFrom" type="date" defaultValue={iDag()} required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="nn">Note</Label>
            <Input id="nn" name="note" placeholder="fx Årlig prisregulering 2027" />
          </div>
          <div className="sm:col-span-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Dags dato eller tidligere: gælder med det samme. Fremtidig dato: venter og træder i kraft på datoen.
            </p>
            <Button type="submit" size="sm">Gem prisændring</Button>
          </div>
        </form>

        <div className="border-t border-border pt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Prishistorik</div>
          {historik.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen prisændringer registreret.</p>
          ) : (
            <ul className="divide-y divide-border">
              {historik.map((h, i) => {
                const venter = h.appliedAt == null;
                const gaeldende = !venter && historik.slice(0, i).every((x) => x.appliedAt == null);
                return (
                  <li key={h.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium tabular">{h.price == null ? "Ingen pris" : `${kroner(h.price)} ${m.enhed}`}</span>
                        {venter && <Badge variant="warning"><CalendarClock className="h-3 w-3 mr-1 inline" />Planlagt</Badge>}
                        {gaeldende && <Badge variant="success"><Check className="h-3 w-3 mr-1 inline" />Gældende</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Fra {dato(h.validFrom)}
                        {h.createdBy && ` · ${h.createdBy}`}
                        {h.note && ` · ${h.note}`}
                      </div>
                    </div>
                    {venter && h.validFrom > nu && (
                      <form action={annullerPrisaendring.bind(null, h.id)}>
                        <Button size="sm" variant="ghost" type="submit" className="text-xs text-muted-foreground hover:text-danger">
                          <X className="h-3.5 w-3.5" /> Annullér
                        </Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
