import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, BookOpen, KeyRound, Check, ChevronRight, Download, ExternalLink, FileBadge, FileText, Flame, RefreshCw, LayoutDashboard, LifeBuoy, ListChecks, Mail, Minus, Package, PackagePlus, Paperclip, Phone, Plus, Scissors, Trash2, TrendingUp, Undo2, Users } from "lucide-react";
import { GemtAf } from "@/components/ui/gemt-af";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { forskelligeUdloeb, kontraktUdloeb, sikrKontrakter } from "@/lib/kontrakter";
import { noegletal } from "@/lib/analysis";
import { gaeldendeMaanedspris } from "@/lib/pricing";
import { ProduktMaerke } from "@/lib/produktstil";
import { dato, datoKort, kroner, millioner, procent, tal } from "@/lib/format";
import {
  AABNE_SAGSSTATUS, erAabenSag, BESLUTNINGSROLLER, FAKTURERING, KONFIDENS, NOTAT_KOLONNER,
  NOTAT_PRIORITET, NOTAT_SPOR, PRIORITET, STADIER,
  findKundestatus, findSagsprioritet, findSagsstatus, findSpor, label,
} from "@/lib/labels";
import { kortnummer, kortstatus, sagsnummer, varighed, alderIDage, alderTekst } from "@/lib/teknik";
import { gemLicenslinje, opretKontakt, sletKontakt, sletLicenslinje, skiftHot } from "@/app/actions/kunder";
import { Statusboard } from "@/components/kunder/Statusboard";
import { KundeFaner } from "@/components/kunder/KundeFaner";
import { BekraeftSlet } from "@/components/ui/bekraeft-slet";
import { afsluttetDage, dageSiden, erAfsluttet } from "@/lib/pipeline";
import { Logbog } from "@/components/kunder/Logbog";
import { NotatFane } from "@/components/kunder/NotatFane";
import { KundestatusKort } from "@/components/kunder/Kundestatus";
import { Filboks } from "@/components/kunder/Filboks";
import { hentFiler } from "@/app/actions/filer";
import { cn } from "@/lib/utils";
import { licensGrupper, licensmodel, listepris } from "@/lib/katalog";
import { LicensOptions } from "@/components/produkter/LicensOptions";
import { fortrydLicensaendring, registrerLicensaendring } from "@/app/actions/tilkoeb";
import { hentSession } from "@/lib/auth";
import { kanLaese, kanSkrive, rettigheder } from "@/lib/roller";
import { dokNr, isoDato, noegleNr, subNr } from "@/lib/dokumenter";
import { aftaleUdloeb, dagTekst } from "@/lib/perioder";
import { ordreTotal } from "@/lib/ordre-pdf";

export const dynamic = "force-dynamic";

const TILKOEB_BESKED: Record<string, { tekst: string; fejl?: boolean }> = {
  gemt: { tekst: "Licensændringen er registreret, og licensantallet er opdateret." },
  fortrudt: { tekst: "Registreringen er fortrudt, og licensantallet er sat tilbage." },
  mangler: { tekst: "Vælg en licens og et antal større end 0.", fejl: true },
  "for-mange": { tekst: "Kunden har ikke så mange licenser at reducere.", fejl: true },
};

function iDag() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default async function KundeSide({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tilkoeb?: string; fil?: string; fane?: string; ryddede?: string; spor?: string; rediger?: string; linje?: string; noegle?: string }>;
}) {
  const { id } = await params;
  const { tilkoeb, fil, fane: faneParam, ryddede, spor, rediger, linje, noegle } = await searchParams;
  await sikrKontrakter(id);
  const [kunde, grupper, filer, mig, indst] = await Promise.all([
    db.company.findUnique({
      where: { id },
      include: {
        customerProducts: { include: { product: { include: { family: true } }, contract: { select: { id: true, subNumber: true } } }, orderBy: { createdAt: "asc" } },
        contracts: {
          orderBy: { subNumber: "asc" },
          include: {
            orders: {
              select: { id: true, kind: true, number: true, status: true, orderDate: true, salesforceUrl: true, appliedAt: true, lines: { select: { quantity: true, unitPrice: true, months: true } } },
              orderBy: [{ orderDate: "desc" }, { number: "desc" }],
              take: 6,
            },
          },
        },
        orders: { include: { lines: true }, orderBy: { number: "desc" }, take: 5 },
        contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
        deals: { include: { product: true }, orderBy: { createdAt: "desc" } },
        tickets: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
        hourBundles: { orderBy: { number: "desc" } },
        logEntries: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 60 },
        activities: { where: { completedAt: null }, orderBy: { dueDate: "asc" }, take: 10 },
        notes_: { select: { id: true, completedAt: true } },
        licenseChanges: {
          include: { product: { select: { name: true } } },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 50,
        },
      },
    }),
    licensGrupper(),
    hentFiler(id),
    hentSession(),
    db.settings.findUnique({ where: { id: "singleton" }, select: { pipelineDoneDays: true } }),
  ]);

  if (!kunde) notFound();

  // Rettigheder (lib/roller.ts). Fanerne følger rollen: en Tekniker ser kun Teknik og
  // Notater, en Sælger kun Salg, Produkter og Notater.
  const ret = rettigheder(mig?.role);
  const salgL = kanLaese(ret.salg), salgS = kanSkrive(ret.salg);
  const teknikL = kanLaese(ret.teknik), teknikS = kanSkrive(ret.teknik);
  const kunderS = kanSkrive(ret.kunder);
  const ALLE_FANER = ["overblik", "kontakter", "salg", "produkter", "dokumenter", "filer", "teknik", "notater", "logbog"] as const;
  type Fane = (typeof ALLE_FANER)[number];
  const FANER: readonly Fane[] = ALLE_FANER.filter((f) =>
    f === "salg" || f === "produkter" || f === "dokumenter" ? salgL : f === "teknik" ? teknikL : true
  );
  // Kommer man fra et tilkøb eller en filupload uden fane i URL'en, er det den fane man skal tilbage til.
  const oensket = (faneParam ?? (tilkoeb ? "produkter" : fil ? "filer" : "overblik")) as Fane;
  const fane: Fane = FANER.includes(oensket) ? oensket : FANER[0];
  const tkBesked = tilkoeb ? TILKOEB_BESKED[tilkoeb] : null;


  const n = noegletal(kunde.customerProducts);
  const prio = kunde.priority ? PRIORITET[kunde.priority] : null;
  const konf = kunde.sizeConfidence ? KONFIDENS[kunde.sizeConfidence] : null;
  const ks = findKundestatus(kunde.customerStatus);
  const nu = new Date();

  const aabneSager = kunde.tickets.filter((t) => erAabenSag(t.status));
  const aktiveKort = kunde.hourBundles.map((k) => ({ k, s: kortstatus(k, nu) })).filter(({ k, s }) => k.isActive && !s.udloebet);
  const restMin = aktiveKort.reduce((sum, { s }) => sum + Math.max(0, s.restMin), 0);

  const dage = afsluttetDage(indst?.pipelineDoneDays);
  const aabneMuligheder = kunde.deals.filter((d) => !erAfsluttet(d.stage));
  const bevaegelser = kunde.logEntries
    .filter((p) => p.kind === "salg")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);
  const lukkedeSager = kunde.tickets
    .filter((t) => !erAabenSag(t.status))
    .sort((a, b) => (b.closedAt ?? b.resolvedAt ?? b.updatedAt).getTime() - (a.closedAt ?? a.resolvedAt ?? a.updatedAt).getTime());
  const nyligLukket = lukkedeSager.filter((t) => (dageSiden(t.closedAt ?? t.resolvedAt ?? t.updatedAt, nu) ?? 0) <= dage);
  const aabneNotater = kunde.notes_.filter((no) => !no.completedAt).length;

  type Linje = (typeof kunde.customerProducts)[number];
  /** Redigeringsformularen for én produktlinje — vises når man klikker linjen. */
  const linjeFormular = (l: Linje) => {
                const perpetual = l.product.licenseModel === "perpetual";
                const pris = gaeldendeMaanedspris(l.unitPriceMonth, l.product);
                const aar = pris == null || perpetual ? null : l.seats * pris * 12;
                return (
                  <form key={l.id} action={gemLicenslinje.bind(null, kunde.id)} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                    <input type="hidden" name="linjeId" value={l.id} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <ProduktMaerke icon={l.product.icon} color={l.product.color} size="md" />
                        {l.product.name}
                        <Badge variant="muted">{noegleNr(l)}</Badge>
                        <Link href={`/kunder/${kunde.id}/licensbevis?linje=${l.id}`} title="Licensbevis for denne licens" className="text-muted-foreground hover:text-primary">
                          <FileBadge className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground tabular">
                        {perpetual
                          ? `Perpetual · ${listepris(l.product) != null ? `${kroner(listepris(l.product))} pr. licens` : "ingen pris"}`
                          : pris == null ? "ingen pris" : `${kroner(pris)}/bruger/md.`}
                        {aar != null && ` · ${kroner(aar)}/år`}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="col-span-2 sm:col-span-4">
                        <Label htmlFor={`k-${l.id}`} hint="flyt linjen ind under en anden kontrakt">SUB-nøgle</Label>
                        <Select id={`k-${l.id}`} name="contractId" defaultValue={l.contractId ?? "ny"}>
                          {kunde.contracts.map((k) => (
                            <option key={k.id} value={k.id}>{subNr(k.subNumber)}{k.name ? ` · ${k.name}` : ""}</option>
                          ))}
                          <option value="ny">Ny SUB-nøgle</option>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor={`p-${l.id}`}>Pakke</Label>
                        <Select id={`p-${l.id}`} name="productId" defaultValue={l.productId}>
                          <LicensOptions grupper={grupper} medtag={l.product} />
                        </Select>
                      </div>
                      <div><Label htmlFor={`s-${l.id}`}>Tildelte</Label><Input id={`s-${l.id}`} name="seats" type="number" min={0} defaultValue={l.seats} /></div>
                      <div><Label htmlFor={`a-${l.id}`}>Aktive</Label><Input id={`a-${l.id}`} name="activeSeats" type="number" min={0} defaultValue={l.activeSeats} /></div>
                      <div className="col-span-2">
                        <Label htmlFor={`u-${l.id}`}>Aftalt pris pr. bruger/md.</Label>
                        <Input id={`u-${l.id}`} name="unitPriceMonth" inputMode="decimal" defaultValue={l.unitPriceMonth ?? ""} placeholder={l.product.pricePerUserMonth != null ? `listepris ${l.product.pricePerUserMonth}` : "ingen listepris"} />
                      </div>
                      <div>
                        <Label htmlFor={`sd-${l.id}`}>Startdato</Label>
                        <Input id={`sd-${l.id}`} name="startDate" type="date" defaultValue={isoDato(l.startDate)} />
                      </div>
                      <div>
                        <Label htmlFor={`b-${l.id}`}>Fakturering</Label>
                        <Select id={`b-${l.id}`} name="billingInterval" defaultValue={l.billingInterval}>
                          {FAKTURERING.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                        </Select>
                      </div>
                      {!perpetual && (
                        <>
                          <div>
                            <Label htmlFor={`t-${l.id}`}>Aftaleperiode</Label>
                            <Select id={`t-${l.id}`} name="termMonths" defaultValue={String(l.termMonths)}>
                              {[...new Set([12, 24, 36, l.termMonths])].sort((a, b) => a - b).map((n) => (
                                <option key={n} value={n}>{n} måneder</option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor={`e-${l.id}`}>Aftale udløber</Label>
                            <Input id={`e-${l.id}`} name="endDate" type="date" defaultValue={isoDato(l.endDate)} title="Tom = beregnes ud fra startdato og aftaleperiode" />
                          </div>
                          <div className="col-span-2 flex items-end justify-between gap-2 pb-1">
                            <span className="text-xs text-muted-foreground">
                              Udløber <b className="text-foreground tabular">{dagTekst(aftaleUdloeb(l))}</b>
                              {!l.endDate && " (beregnet)"}
                            </span>
                            <Link href={`/ordrer/ny?kunde=${kunde.id}&forny=${l.id}`}>
                              <Button size="sm" variant="secondary" type="button"><RefreshCw className="h-3.5 w-3.5" /> Lav fornyelse</Button>
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                    <div><Label htmlFor={`n-${l.id}`}>Note</Label><Input id={`n-${l.id}`} name="notes" defaultValue={l.notes ?? ""} placeholder="fx moduler eller aftalenummer" /></div>
                    <div className="flex justify-between items-center">
                      <BekraeftSlet
                        hvad={`licenslinjen "${l.product.name}"`}
                        detalje="Licenserne på linjen fjernes fra kunden."
                        formAction={async () => { "use server"; await sletLicenslinje(l.id); }}
                        className="h-8 px-3 text-xs text-muted-foreground hover:text-danger"
                      >
                        Fjern linje
                      </BekraeftSlet>
                      <div className="flex items-center gap-3">
                        <GemtAf af={l.updatedBy} tid={l.updatedAt} />
                        <Button size="sm" type="submit">Gem</Button>
                      </div>
                    </div>
                  </form>
                );
  };
  const valgtLinje = linje ? kunde.customerProducts.find((l) => l.id === linje) ?? null : null;
  // Linjerne grupperet under deres SUB-nøgle (kontrakt)
  const noegler = [
    ...kunde.contracts.map((k) => {
      const linjer = kunde.customerProducts.filter((l) => l.contractId === k.id);
      return { k, linjer, udloeb: kontraktUdloeb(linjer, nu), skaev: forskelligeUdloeb(linjer, nu) };
    }),
    ...(kunde.customerProducts.some((l) => !l.contractId)
      ? [{ k: null, linjer: kunde.customerProducts.filter((l) => !l.contractId), udloeb: null, skaev: false }]
      : []),
  ].filter((g) => g.linjer.length > 0 || (g.k && g.k.orders.length > 0));
  const linjeHistorik = valgtLinje ? kunde.licenseChanges.filter((c) => c.productId === valgtLinje.productId) : [];
  const linjeAar = (l: Linje) => {
    const pris = gaeldendeMaanedspris(l.unitPriceMonth, l.product);
    return pris == null || l.product.licenseModel === "perpetual" ? null : l.seats * pris * 12;
  };


  return (
    <div className="flex flex-col gap-5 max-w-[1300px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/kunder" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Alle kunder
          </Link>
          <h1 className="mt-1.5 text-xl font-semibold flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: ks.bg }} aria-hidden />
            {kunde.name}
            {kunde.isHot && (
              <span
                title={kunde.hotSetBy ? `Markeret Hot af ${kunde.hotSetBy}` : "Markeret Hot"}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-orange-500/10 text-orange-600"
              >
                <Flame className="h-3 w-3" /> Hot
              </span>
            )}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={ks.variant}>{ks.label}</Badge>
            <span>{kunde.country}</span>
            {kunde.industry && <><span>·</span><span>{kunde.industry}</span></>}
            {kunde.accountId && <><span>·</span><span className="tabular">Konto {kunde.accountId}</span></>}
            {prio && <Badge variant={prio.variant}>Prioritet: {prio.label}</Badge>}
          </div>
          {kunde.customerStatusNote && (
            <p className="mt-1.5 text-xs text-muted-foreground max-w-prose">{kunde.customerStatusNote}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {teknikS && (
          <form action={skiftHot.bind(null, kunde.id, !kunde.isHot)}>
            <Button
              variant="secondary"
              size="sm"
              type="submit"
              title={kunde.isHot ? "Fjern Hot-markering" : "Marker Hot — mulighed for at hente flere timer"}
              className={kunde.isHot ? "knap-hot" : ""}
            >
              <Flame className="h-3.5 w-3.5" /> {kunde.isHot ? "Hot" : "Marker Hot"}
            </Button>
          </form>
          )}
          {kunderS && <Link href={`/kunder/${kunde.id}/rediger`}><Button variant="secondary" size="sm">Rediger</Button></Link>}
          {mig?.erAdmin && (
          <Link href={`/kunder/${kunde.id}/slet`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" /> Slet
            </Button>
          </Link>
          )}
        </div>
      </div>

      <KundeFaner
        kundeId={kunde.id}
        aktiv={fane}
        faner={[
          { key: "overblik", label: "Overblik", ikon: LayoutDashboard },
          { key: "kontakter", label: "Kontakter", ikon: Users, antal: kunde.contacts.length, hint: "kontaktpersoner" },
          { key: "salg", label: "Salg", ikon: TrendingUp, antal: aabneMuligheder.length, hint: "åbne muligheder" },
          { key: "produkter", label: "Produkter", ikon: Package, antal: kunde.customerProducts.length, hint: "produktlinjer" },
          { key: "dokumenter", label: "Dokumenter", ikon: FileText, antal: kunde.orders.length, hint: "seneste tilbud og ordrer" },
          { key: "filer", label: "Filer", ikon: Paperclip, antal: filer.length, hint: "filer" },
          { key: "teknik", label: "Teknik", ikon: LifeBuoy, antal: aabneSager.length, hint: "åbne sager" },
          { key: "notater", label: "Notater", ikon: ListChecks, antal: aabneNotater, hint: "åbne notater" },
          { key: "logbog", label: "Logbog", ikon: BookOpen, antal: kunde.logEntries.length, hint: "poster" },
        ].filter((f) => FANER.includes(f.key as Fane))}
      />

      {fane === "overblik" && (
        <>
        <div className="kpi-grid grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-5">
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Licenser</div>
            <div className="mt-1 text-2xl font-semibold tabular">{n.aktive} / {n.seats}</div>
            <div className={cn("mt-0.5 text-xs tabular", n.fuld ? "text-danger font-medium" : "text-muted-foreground")}>
              {procent(n.udnyttelse)}{n.ledige < 0 ? " — overforbrug" : n.ledige === 0 ? " — ingen ledige" : ` · ${n.ledige} ledige`}
            </div>
          </div>
          {salgL && (
          <div className="bg-card border border-primary/40 bg-primary/[0.04] rounded-xl px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Årlig licensværdi</div>
            <div className="mt-1 text-2xl font-semibold tabular text-primary">{n.aarsvaerdi > 0 ? kroner(n.aarsvaerdi) : "–"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{n.udenPris > 0 ? "pakke mangler pris" : "på nuværende licenser"}</div>
          </div>
          )}
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Åbne sager</div>
            <div className="mt-1 text-2xl font-semibold tabular">{tal(aabneSager.length)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{tal(kunde.tickets.length)} i alt</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Timer på kort</div>
            <div className="mt-1 text-2xl font-semibold tabular">{aktiveKort.length ? varighed(restMin) : "–"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{tal(aktiveKort.length)} aktive klippekort</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Ansatte</div>
            <div className="mt-1 text-2xl font-semibold tabular">{tal(kunde.employees)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{millioner(kunde.revenueMdkk)} i omsætning</div>
          </div>
        </div>
          <div className="grid gap-5 lg:grid-cols-2 items-start">
            <div className="flex flex-col gap-5">
              <KundestatusKort
                kanSkrive={kunderS}
                kundeId={kunde.id}
                status={kunde.customerStatus}
                note={kunde.customerStatusNote}
                sat={kunde.customerStatusAt}
                gemtAf={kunde.updatedBy}
                gemtTid={kunde.updatedAt}
              />
              {kunde.activities.length > 0 && (
                <Card>
                  <CardHeader title="Åbne opgaver" action={<Link href="/aktiviteter" className="text-xs font-medium text-primary hover:underline">Alle</Link>} />
                  <CardBody className="p-0">
                    <ul className="divide-y divide-border">
                      {kunde.activities.map((a) => (
                        <li key={a.id} className="px-5 py-2.5 text-sm flex items-center justify-between gap-3">
                          <span className="truncate">{a.subject}</span>
                          {a.dueDate && (
                            <span className={cn("text-xs tabular shrink-0", a.dueDate < nu ? "text-danger font-medium" : "text-muted-foreground")}>
                              {datoKort(a.dueDate)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}
            </div>
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader title="Stamdata" />
                <CardBody className="flex flex-col gap-3 text-sm">
                  <Raek label="Adresse" vaerdi={kunde.address ?? "–"} />
                  <Raek label="Telefon" vaerdi={kunde.phone ? <a className="text-primary hover:underline inline-flex items-center gap-1" href={`tel:${kunde.phone}`}><Phone className="h-3 w-3" />{kunde.phone}</a> : "–"} />
                  <Raek label="Mail" vaerdi={kunde.email ? <a className="text-primary hover:underline inline-flex items-center gap-1 break-all" href={`mailto:${kunde.email}`}><Mail className="h-3 w-3 shrink-0" />{kunde.email}</a> : "–"} />
                  <Raek label="Subdomæne" vaerdi={kunde.subdomain ?? "–"} />
                  <Raek label="Kode" vaerdi={kunde.code ?? "–"} />
                  {kunde.notes && <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">{kunde.notes}</p>}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Firmastørrelse" description="Baggrundsviden. Indgår ikke i pris, pakke eller scope." />
                <CardBody className="flex flex-col gap-3 text-sm">
                  <Raek label="Ansatte" vaerdi={tal(kunde.employees)} />
                  <Raek label="Omsætning" vaerdi={millioner(kunde.revenueMdkk)} />
                  <Raek label="Konfidens" vaerdi={konf ? <Badge variant={konf.variant}>{konf.label}</Badge> : "–"} />
                  {kunde.sizeNote && <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">{kunde.sizeNote}</p>}
                  {kunde.sourceUrl && (
                    <a href={kunde.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {kunde.sourceUrl}
                    </a>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}

      {fane === "produkter" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr] items-start">
          <Card>
            <CardHeader
              title="Eksisterende produkter"
              description="Kundens licenslinjer. Klik en linje for at se og rette alt om produktet på denne kunde."
              action={<span className="text-xs text-muted-foreground tabular">{tal(n.seats)} licenser · {n.aarsvaerdi > 0 ? `${kroner(n.aarsvaerdi)}/år` : "–"}</span>}
            />
            <CardBody className="p-0">
              {kunde.customerProducts.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen produkter endnu" icon={PackagePlus} description="Tilføj den første pakke nedenfor." /></div>
              ) : (
                <ul>
                  <li className="hidden sm:grid grid-cols-[1fr_5.5rem_6.5rem_1rem] gap-3 px-5 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <span>Produkt</span><span className="text-right">Licenser</span><span className="text-right">Årsværdi</span><span />
                  </li>
                  {noegler.map(({ k, linjer, udloeb, skaev }) => (
                    <li key={k?.id ?? "uden"} id={k ? `noegle-${k.id}` : undefined} className={cn("scroll-mt-24", k && noegle === k.id && "ring-2 ring-primary/40 ring-inset")}>
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-2.5 bg-secondary/50 border-b border-border">
                        <div className="min-w-0 flex items-center gap-2 text-sm">
                          <KeyRound className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-semibold tabular">{k ? subNr(k.subNumber) : "Uden nøgle"}</span>
                          {k?.name && <span className="text-muted-foreground truncate">· {k.name}</span>}
                          <span className="text-xs text-muted-foreground tabular">
                            {udloeb ? `udløber ${dagTekst(udloeb)}` : "ingen løbende abonnementer"}
                          </span>
                          {skaev && (
                            <span title="Licenserne på nøglen har forskellige udløb" className="text-warning"><AlertTriangle className="h-3.5 w-3.5" /></span>
                          )}
                        </div>
                        {k && (
                          <div className="flex items-center gap-1.5">
                            <Link href={`/kunder/${kunde.id}/licensbevis?noegle=${k.id}`} title="Licensbevis for nøglen" className="inline-grid place-items-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary">
                              <FileBadge className="h-3.5 w-3.5" />
                            </Link>
                            {salgS && (
                              <Link href={`/ordrer/ny?type=tilbud&kunde=${kunde.id}&kontrakt=${k.id}`}>
                                <Button size="sm" variant="secondary" type="button" className="h-7"><Plus className="h-3.5 w-3.5" /> Tilkøb</Button>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                      <ul>
                  {linjer.map((l) => {
                    const valgt = l.id === valgtLinje?.id;
                    const perpetual = l.product.licenseModel === "perpetual";
                    const aar = linjeAar(l);
                    return (
                      <li key={l.id} className="border-b border-border/60 last:border-0 even:bg-muted/45">
                        <Link
                          href={valgt ? `/kunder/${kunde.id}?fane=produkter` : `/kunder/${kunde.id}?fane=produkter&linje=${l.id}`}
                          scroll={false}
                          aria-current={valgt ? "true" : undefined}
                          className={cn(
                            "grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_5.5rem_6.5rem_1rem] gap-x-3 gap-y-1 items-center px-5 py-3 transition-colors border-l-2",
                            valgt ? "bg-primary/[0.07] border-primary" : "border-transparent hover:bg-primary/[0.04]"
                          )}
                        >
                          <span className="min-w-0 flex items-center gap-2.5">
                            <ProduktMaerke icon={l.product.icon} color={l.product.color} size="md" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium truncate">{l.product.name}</span>
                              <span className="block text-[11px] text-muted-foreground tabular truncate">
                                {perpetual ? "Perpetual" : `udløber ${dagTekst(aftaleUdloeb(l))}`}{l.seats > 0 && !perpetual && l.unitPriceMonth != null ? " · aftalt pris" : ""}
                              </span>
                            </span>
                          </span>
                          <span className="text-right text-sm tabular">
                            {l.activeSeats}<span className="text-muted-foreground"> / {l.seats}</span>
                          </span>
                          <span className="hidden sm:block text-right text-sm tabular">{aar != null ? kroner(aar) : "–"}</span>
                          <ChevronRight className={cn("hidden sm:block h-4 w-4 transition-transform", valgt ? "text-primary rotate-90 lg:rotate-0" : "text-muted-foreground/50")} />
                        </Link>
                      </li>
                    );
                  })}
                      </ul>
                      {k && k.orders.length > 0 && (
                        <ul className="px-5 py-2 border-t border-border/60 flex flex-col gap-1 bg-background/40">
                          {k.orders.map((o) => (
                            <li key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <Link href={`/ordrer/${o.id}`} className="font-medium tabular hover:text-primary">{dokNr(o)}</Link>
                              <span className="text-muted-foreground tabular">{datoKort(o.orderDate)}</span>
                              <span className="tabular">{kroner(ordreTotal(o.lines))}</span>
                              {o.kind === "tilbud" ? (
                                o.status === "godkendt" ? <Badge variant="success">Godkendt</Badge>
                                : o.status === "afvist" ? <Badge variant="danger">Afvist</Badge>
                                : <Badge variant="info">Afventer</Badge>
                              ) : o.appliedAt ? <Badge variant="success">Lagt på nøglen</Badge> : <Badge variant="warning">Ikke overført</Badge>}
                              {o.salesforceUrl && (
                                <a href={o.salesforceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" /> Salesforce
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {salgS && (
              <div className="p-4 border-t border-border">
              <details className="rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">Tilføj pakke</summary>
                <form action={gemLicenslinje.bind(null, kunde.id)} className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="col-span-2">
                    <Label htmlFor="np">Pakke</Label>
                    <Select id="np" name="productId" required>
                      <LicensOptions grupper={grupper} />
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Label htmlFor="nk">SUB-nøgle</Label>
                    <Select id="nk" name="contractId" defaultValue="ny">
                      <option value="ny">Ny SUB-nøgle (ny kontrakt)</option>
                      {kunde.contracts.map((k) => (
                        <option key={k.id} value={k.id}>Læg under {subNr(k.subNumber)}{k.name ? ` · ${k.name}` : ""}</option>
                      ))}
                    </Select>
                  </div>
                  <div><Label htmlFor="ns">Tildelte</Label><Input id="ns" name="seats" type="number" min={0} defaultValue={1} /></div>
                  <div><Label htmlFor="na">Aktive</Label><Input id="na" name="activeSeats" type="number" min={0} defaultValue={0} /></div>
                  <div className="col-span-2 sm:col-span-4 flex justify-end"><Button size="sm" type="submit">Tilføj</Button></div>
                </form>
              </details>
              </div>
              )}
            </CardBody>
          </Card>

          {valgtLinje ? (
            <div className="flex flex-col gap-5 lg:sticky lg:top-20">
              <Card>
                <CardHeader
                  title={<span className="flex items-center gap-2"><ProduktMaerke icon={valgtLinje.product.icon} color={valgtLinje.product.color} size="md" />{valgtLinje.product.name}</span>}
                  description={`${noegleNr(valgtLinje)}${valgtLinje.product.family ? ` · ${valgtLinje.product.family.name}` : ""} · tilføjet ${datoKort(valgtLinje.createdAt)}`}
                  action={<Link href={`/kunder/${kunde.id}?fane=produkter`} scroll={false} className="text-xs font-medium text-muted-foreground hover:text-foreground">Luk</Link>}
                />
                <CardBody className="flex flex-col gap-4">
                  {/* Læseadgang: samme felter, men låst. */}
                  <fieldset disabled={!salgS} className="contents">{linjeFormular(valgtLinje)}</fieldset>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/kunder/${kunde.id}/licensbevis?linje=${valgtLinje.id}`}>
                      <Button size="sm" variant="secondary"><FileBadge className="h-3.5 w-3.5" /> Licensbevis</Button>
                    </Link>
                    {salgS && (
                    <Link href={`/ordrer/ny?type=ordre&kunde=${kunde.id}`}>
                      <Button size="sm" variant="ghost"><FileText className="h-3.5 w-3.5" /> Ny ordre</Button>
                    </Link>
                    )}
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Historik på produktet"
                  description="Tilkøb og reduktioner registreret på denne licens."
                  action={<Link href={`/kunder/${kunde.id}?fane=produkter#tilkoeb`} scroll={false} className="text-xs font-medium text-primary hover:underline">Registrér ændring</Link>}
                />
                <CardBody className="p-0">
              {linjeHistorik.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen ændringer på denne licens" icon={PackagePlus} /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {linjeHistorik.map((c) => {
                    const perpetual = c.licenseModel === "perpetual";
                    const vaerdi = c.unitPrice == null ? null : c.quantity * c.unitPrice * (perpetual ? 1 : 12);
                    return (
                      <li key={c.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            {c.quantity > 0
                              ? <Plus className="h-3.5 w-3.5 text-success shrink-0" />
                              : <Minus className="h-3.5 w-3.5 text-danger shrink-0" />}
                            <span className="tabular">{Math.abs(c.quantity)}</span> × {c.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground tabular">
                            {datoKort(c.date)} · {c.seatsBefore} → {c.seatsAfter} licenser
                            {c.unitPrice != null && ` · ${kroner(c.unitPrice)} ${licensmodel(c.licenseModel).enhed}`}
                            {c.createdBy && ` · ${c.createdBy}`}
                          </div>
                          {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {vaerdi != null && (
                            <span className={cn("text-xs tabular", vaerdi < 0 ? "text-danger" : "text-foreground")}>
                              {vaerdi > 0 ? "+" : ""}{kroner(vaerdi)}{perpetual ? " engang" : "/år"}
                            </span>
                          )}
                          {mig?.erAdmin && (
                            <form action={fortrydLicensaendring.bind(null, c.id)}>
                              <BekraeftSlet hvad="registreringen" detalje="Posten slettes, og licensantallet sættes tilbage." title="Fortryd — sletter posten og sætter licensantallet tilbage" className="p-1 rounded text-muted-foreground hover:text-danger">
                                <Undo2 className="h-3.5 w-3.5" />
                              </BekraeftSlet>
                            </form>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
                </CardBody>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
          <Card>
            <div id="tilkoeb" className="scroll-mt-24" />
            <CardHeader
              title={<span className="flex items-center gap-2"><PackagePlus className="h-4 w-4" />Tilkøb og licensændringer</span>}
              description="Registrér tilkøb eller reduktion. Licensantallet på linjen opdateres, og posten gemmes i historikken og logbogen."
              action={<Link href={`/tilkoeb?kunde=${kunde.id}`} className="text-xs font-medium text-primary hover:underline">Alle tilkøb</Link>}
            />
            <CardBody className="p-0">
              {tkBesked && (
                <div className={cn("mx-5 mt-4 rounded-lg px-3 py-2 text-sm", tkBesked.fejl ? "bg-danger/[0.08] text-danger" : "bg-success/[0.08]")}>
                  {tkBesked.tekst}
                </div>
              )}
              {salgS && <form action={registrerLicensaendring.bind(null, kunde.id)} className="px-5 py-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end border-b border-border">
                <div className="col-span-2 sm:col-span-3">
                  <Label htmlFor="tk-l">Licens</Label>
                  <Select id="tk-l" name="productId" required>
                    <LicensOptions grupper={grupper} />
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="tk-r">Type</Label>
                  <Select id="tk-r" name="retning" defaultValue="tilkoeb">
                    <option value="tilkoeb">Tilkøb (+)</option>
                    <option value="reduktion">Reduktion (−)</option>
                  </Select>
                </div>
                <div><Label htmlFor="tk-a">Antal</Label><Input id="tk-a" name="antal" type="number" min={1} defaultValue={1} required /></div>
                <div className="sm:col-span-2"><Label htmlFor="tk-d">Dato</Label><Input id="tk-d" name="date" type="date" defaultValue={iDag()} /></div>
                <div className="sm:col-span-2">
                  <Label htmlFor="tk-p">Pris pr. licens (kr.)</Label>
                  <Input id="tk-p" name="unitPrice" inputMode="decimal" placeholder="tom = aftalt pris / listepris" />
                </div>
                <div className="col-span-2 sm:col-span-2"><Label htmlFor="tk-n">Note</Label><Input id="tk-n" name="note" placeholder="fx ordre 1234" /></div>
                <div className="col-span-2 sm:col-span-6 flex justify-end"><Button size="sm" type="submit">Registrér</Button></div>
              </form>}

              {kunde.licenseChanges.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen tilkøb registreret" icon={PackagePlus} /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {kunde.licenseChanges.map((c) => {
                    const perpetual = c.licenseModel === "perpetual";
                    const vaerdi = c.unitPrice == null ? null : c.quantity * c.unitPrice * (perpetual ? 1 : 12);
                    return (
                      <li key={c.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            {c.quantity > 0
                              ? <Plus className="h-3.5 w-3.5 text-success shrink-0" />
                              : <Minus className="h-3.5 w-3.5 text-danger shrink-0" />}
                            <span className="tabular">{Math.abs(c.quantity)}</span> × {c.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground tabular">
                            {datoKort(c.date)} · {c.seatsBefore} → {c.seatsAfter} licenser
                            {c.unitPrice != null && ` · ${kroner(c.unitPrice)} ${licensmodel(c.licenseModel).enhed}`}
                            {c.createdBy && ` · ${c.createdBy}`}
                          </div>
                          {c.note && <p className="text-xs text-muted-foreground mt-0.5">{c.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {vaerdi != null && (
                            <span className={cn("text-xs tabular", vaerdi < 0 ? "text-danger" : "text-foreground")}>
                              {vaerdi > 0 ? "+" : ""}{kroner(vaerdi)}{perpetual ? " engang" : "/år"}
                            </span>
                          )}
                          {mig?.erAdmin && (
                            <form action={fortrydLicensaendring.bind(null, c.id)}>
                              <BekraeftSlet hvad="registreringen" detalje="Posten slettes, og licensantallet sættes tilbage." title="Fortryd — sletter posten og sætter licensantallet tilbage" className="p-1 rounded text-muted-foreground hover:text-danger">
                                <Undo2 className="h-3.5 w-3.5" />
                              </BekraeftSlet>
                            </form>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

            </div>
          )}
        </div>
      )}

      {fane === "notater" && <NotatFane kundeId={kunde.id} spor={spor} rediger={rediger} ret={ret} />}

      {fane === "salg" && (
        <Statusboard
          kundeId={kunde.id}
          sager={kunde.deals}
          grupper={grupper}
          dage={dage}
          visRyddede={ryddede === "1"}
          bevaegelser={bevaegelser}
          kanSkrive={salgS}
          kanOpretteLead={salgS || ret.leads}
        />
      )}

      {fane === "kontakter" && (
        <div className="max-w-3xl">
            <Card>
              <CardHeader title="Kontakter" />
              <CardBody className="p-0">
                {kunde.contacts.length === 0 ? (
                  <div className="px-5"><EmptyState title="Ingen kontakter" description="Tilføj den du taler med hos kunden." /></div>
                ) : (
                  <ul className="divide-y divide-border">
                    {kunde.contacts.map((c) => (
                      <li key={c.id} className="px-5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {c.firstName} {c.lastName}
                            {c.isPrimary && <Badge variant="info">Primær</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {[c.title, label(BESLUTNINGSROLLER, c.decisionRole ?? "")].filter((x) => x && x !== "Ikke angivet").join(" · ") || "–"}
                          </div>
                          {c.email && <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline break-all">{c.email}</a>}
                        </div>
                        {kunderS && <form action={sletKontakt.bind(null, c.id, kunde.id)}>
                          <BekraeftSlet hvad={`kontakten ${c.firstName} ${c.lastName}`.trim()} className="text-muted-foreground hover:text-danger p-1 rounded" />
                        </form>}
                      </li>
                    ))}
                  </ul>
                )}
                {kunderS && <details className="px-5 py-4 border-t border-border">
                  <summary className="cursor-pointer text-sm font-medium">Tilføj kontakt</summary>
                  <form action={opretKontakt.bind(null, kunde.id)} className="mt-3 grid grid-cols-2 gap-3">
                    <div><Label htmlFor="kf">Fornavn</Label><Input id="kf" name="firstName" required /></div>
                    <div><Label htmlFor="kl">Efternavn</Label><Input id="kl" name="lastName" /></div>
                    <div className="col-span-2"><Label htmlFor="ke">Mail</Label><Input id="ke" name="email" type="email" /></div>
                    <div><Label htmlFor="kp">Telefon</Label><Input id="kp" name="phone" /></div>
                    <div><Label htmlFor="kt">Stilling</Label><Input id="kt" name="title" /></div>
                    <div className="col-span-2">
                      <Label htmlFor="kr">Rolle i beslutningen</Label>
                      <Select id="kr" name="decisionRole">
                        {BESLUTNINGSROLLER.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </Select>
                    </div>
                    <div className="col-span-2 flex justify-end"><Button size="sm" type="submit">Tilføj kontakt</Button></div>
                  </form>
                </details>}
              </CardBody>
            </Card>
        </div>
      )}

      {fane === "dokumenter" && (
        <div className="max-w-3xl">
            <Card>
              <CardHeader
                title="Dokumenter"
                description="Licensbevis med faste licensnumre (SUB), tilbud, ordrebekræftelser og fornyelser som PDF."
                action={<Link href={`/ordrer?kunde=${kunde.id}`} className="text-xs font-medium text-primary hover:underline">Alle tilbud og ordrer</Link>}
              />
              <CardBody className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Link href={`/kunder/${kunde.id}/licensbevis`}>
                    <Button size="sm" variant="secondary"><FileBadge className="h-3.5 w-3.5" /> Licensbevis — alle licenser</Button>
                  </Link>
                  {[...new Map(kunde.customerProducts.filter((l) => l.product.family).map((l) => [l.product.family!.id, l.product.family!.name])).entries()].map(([fid, navn]) => (
                    <Link key={fid} href={`/kunder/${kunde.id}/licensbevis?produkt=${fid}`}>
                      <Button size="sm" variant="ghost"><FileBadge className="h-3.5 w-3.5" /> Kun {navn}</Button>
                    </Link>
                  ))}
                </div>
                {salgS && <div className="flex flex-wrap gap-2">
                  <Link href={`/ordrer/ny?type=tilbud&kunde=${kunde.id}`}>
                    <Button size="sm" variant="secondary"><FileText className="h-3.5 w-3.5" /> Nyt tilbud</Button>
                  </Link>
                  <Link href={`/ordrer/ny?type=ordre&kunde=${kunde.id}`}>
                    <Button size="sm"><FileText className="h-3.5 w-3.5" /> Ny ordrebekræftelse</Button>
                  </Link>
                  {[...new Map(kunde.customerProducts.filter((l) => l.product.family && l.product.licenseModel !== "perpetual").map((l) => [l.product.family!.id, l.product.family!.name])).entries()].map(([fid, navn]) => (
                    <Link key={fid} href={`/ordrer/ny?kunde=${kunde.id}&fornyProdukt=${fid}`}>
                      <Button size="sm" variant="ghost"><RefreshCw className="h-3.5 w-3.5" /> Forny {navn}</Button>
                    </Link>
                  ))}
                </div>}
                {kunde.orders.length > 0 && (
                  <ul className="divide-y divide-border border-t border-border">
                    {kunde.orders.map((o) => (
                      <li key={o.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <Link href={`/ordrer/${o.id}`} className="hover:text-primary">
                          <span className="font-medium tabular">{dokNr(o)}</span>
                          {o.kind === "tilbud" && <Badge variant="warning" className="ml-2">Tilbud</Badge>}
                          <span className="text-xs text-muted-foreground ml-2 tabular">{datoKort(o.orderDate)} · {o.lines.length} linjer</span>
                        </Link>
                        <span className="flex items-center gap-2">
                          <span className="text-xs tabular">{kroner(ordreTotal(o.lines))}</span>
                          <a href={`/api/dokumenter/ordre/${o.id}`} title="Hent PDF" className="text-muted-foreground hover:text-primary p-1"><Download className="h-3.5 w-3.5" /></a>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
        </div>
      )}

      {fane === "filer" && (
        <div className="max-w-3xl">
            <Filboks companyId={kunde.id} filer={filer} forStor={fil === "for-stor"} kanSkrive={kunderS} />
        </div>
      )}

      {fane === "teknik" && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Card>
            <CardHeader
              title="Sager"
              description="Åbne sager står øverst. Løste og lukkede vises en tid og ryddes så væk."
              action={
                <div className="flex items-center gap-3">
                  <Link href={`/teknik/sager?kunde=${kunde.id}`} className="text-xs font-medium text-primary hover:underline">Alle sager</Link>
                  {teknikS && (
                  <Link href={`/teknik/sager/ny?kunde=${kunde.id}`}>
                    <Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Ny sag</Button>
                  </Link>
                  )}
                </div>
              }
            />
            <CardBody className="p-0">
              {aabneSager.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen åbne sager" icon={LifeBuoy} description="Opret en når kunden melder noget ind." /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {[...aabneSager]
                    .sort((a, b) => findSagsprioritet(b.priority).rang - findSagsprioritet(a.priority).rang || a.createdAt.getTime() - b.createdAt.getTime())
                    .map((t) => {
                      const p = findSagsprioritet(t.priority);
                      const st = findSagsstatus(t.status);
                      const overskredet = t.dueAt != null && t.dueAt < nu;
                      return (
                        <li key={t.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/teknik/sager/${t.id}`} className="text-sm font-medium hover:text-primary block truncate">{t.title}</Link>
                            <div className="text-xs text-muted-foreground tabular">
                              {sagsnummer(t.number)} · {alderTekst(alderIDage(t.createdAt, nu))}
                              {t.dueAt && <> · <span className={cn(overskredet && "text-danger font-medium")}>frist {datoKort(t.dueAt)}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={p.variant}>{p.label}</Badge>
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
              {nyligLukket.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Løst for nylig · sidste {dage} dage
                  </div>
                  <ul className="divide-y divide-border">
                    {nyligLukket.map((t) => {
                      const st = findSagsstatus(t.status);
                      return (
                        <li key={t.id} className="px-5 py-2 flex items-center justify-between gap-3 opacity-75">
                          <Link href={`/teknik/sager/${t.id}`} className="text-sm hover:text-primary truncate min-w-0">
                            {t.title}
                            <span className="text-xs text-muted-foreground tabular ml-2">{sagsnummer(t.number)}</span>
                          </Link>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {lukkedeSager.length > nyligLukket.length && (
                <div className="px-5 py-2.5 border-t border-border text-xs text-muted-foreground">
                  {tal(lukkedeSager.length - nyligLukket.length)} ældre lukkede sager er ryddet væk ·{" "}
                  <Link href={`/teknik/sager?kunde=${kunde.id}&status=alle`} className="text-primary hover:underline">se dem under Teknik</Link>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Klippekort"
              description="Timer kunden har købt, og hvad der er tilbage."
              action={<Link href="/teknik/klippekort" className="text-xs font-medium text-primary hover:underline">Alle klippekort</Link>}
            />
            <CardBody className={kunde.hourBundles.length ? "flex flex-col gap-3" : "p-0"}>
              {kunde.hourBundles.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen klippekort" icon={Scissors} description="Opret et under Teknik → Klippekort." /></div>
              ) : (
                kunde.hourBundles.map((k) => {
                  const s = kortstatus(k, nu);
                  const inaktiv = !k.isActive || s.udloebet;
                  return (
                    <div key={k.id} className={cn("rounded-lg border border-border px-4 py-3", inaktiv && "opacity-60")}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="tabular">{kortnummer(k.number)}</span>
                          {k.name && <span className="text-muted-foreground font-normal truncate">{k.name}</span>}
                        </span>
                        <span className={cn("text-xs tabular", s.opbrugt ? "text-danger font-medium" : s.naestenOpbrugt ? "text-warning font-medium" : "text-muted-foreground")}>
                          {varighed(Math.max(0, s.restMin))} tilbage af {varighed(s.koebteMin)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-sm bg-muted overflow-hidden" aria-hidden>
                        <div
                          className={cn("h-full rounded-sm", s.opbrugt ? "bg-danger" : s.naestenOpbrugt ? "bg-warning" : "bg-primary/70")}
                          style={{ width: `${Math.min(100, Math.round(s.forbrugt * 100))}%` }}
                        />
                      </div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground tabular">
                        {inaktiv ? (s.udloebet ? "Udløbet" : "Inaktivt") : "Aktivt"}
                        {k.expiresAt && ` · udløber ${datoKort(k.expiresAt)}`}
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {fane === "logbog" && (
        <div className="max-w-3xl">
            <Logbog kundeId={kunde.id} poster={kunde.logEntries} kanSkrive={kunderS || salgS || teknikS || ret.leads || ret.tid} />
        </div>
      )}
    </div>
  );
}


function Raek({ label, vaerdi }: { label: string; vaerdi: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right min-w-0">{vaerdi}</span>
    </div>
  );
}
