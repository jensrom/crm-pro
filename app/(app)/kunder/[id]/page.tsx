import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Download, ExternalLink, FileBadge, FileText, Flame, RefreshCw, LifeBuoy, ListChecks, Mail, Minus, PackagePlus, Phone, Plus, Scissors, Trash2, Undo2 } from "lucide-react";
import { GemValg } from "@/components/ui/gem-valg";
import { GemtAf } from "@/components/ui/gemt-af";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { noegletal } from "@/lib/analysis";
import { gaeldendeMaanedspris } from "@/lib/pricing";
import { ProduktMaerke } from "@/lib/produktstil";
import { dato, datoKort, kroner, millioner, procent, tal } from "@/lib/format";
import {
  AABNE_SAGSSTATUS, BESLUTNINGSROLLER, FAKTURERING, KONFIDENS, NOTAT_KOLONNER,
  NOTAT_PRIORITET, NOTAT_SPOR, PRIORITET, STADIER,
  findKundestatus, findSagsprioritet, findSagsstatus, findSpor, label,
} from "@/lib/labels";
import { kortnummer, kortstatus, sagsnummer, varighed, alderIDage, alderTekst } from "@/lib/teknik";
import { gemLicenslinje, opretKontakt, sletKontakt, sletLicenslinje, skiftHot } from "@/app/actions/kunder";
import { flytStadie, opretSag as opretSalgssag } from "@/app/actions/salg";
import { Logbog } from "@/components/kunder/Logbog";
import { opretNotat, skiftFaerdig } from "@/app/actions/notater";
import { KundestatusKort } from "@/components/kunder/Kundestatus";
import { Filboks } from "@/components/kunder/Filboks";
import { hentFiler } from "@/app/actions/filer";
import { cn } from "@/lib/utils";
import { licensGrupper, licensmodel, listepris } from "@/lib/katalog";
import { LicensOptions } from "@/components/produkter/LicensOptions";
import { fortrydLicensaendring, registrerLicensaendring } from "@/app/actions/tilkoeb";
import { hentSession } from "@/lib/auth";
import { dokNr, isoDato, sikrSubNumre, subNr } from "@/lib/dokumenter";
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
  searchParams: Promise<{ tilkoeb?: string; fil?: string }>;
}) {
  const { id } = await params;
  const { tilkoeb, fil } = await searchParams;
  await sikrSubNumre(id);
  const [kunde, grupper, filer, mig] = await Promise.all([
    db.company.findUnique({
      where: { id },
      include: {
        customerProducts: { include: { product: { include: { family: true } } }, orderBy: { createdAt: "asc" } },
        orders: { include: { lines: true }, orderBy: { number: "desc" }, take: 5 },
        contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
        deals: { include: { product: true }, orderBy: { createdAt: "desc" } },
        tickets: { orderBy: [{ status: "asc" }, { createdAt: "asc" }] },
        hourBundles: { orderBy: { number: "desc" } },
        logEntries: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 60 },
        activities: { where: { completedAt: null }, orderBy: { dueDate: "asc" }, take: 10 },
        notes_: { orderBy: [{ completedAt: "asc" }, { position: "asc" }], take: 25 },
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
  ]);

  if (!kunde) notFound();
  const tkBesked = tilkoeb ? TILKOEB_BESKED[tilkoeb] : null;

  // Stale Prisma Client (sandbox kan ikke regenerere) kender endnu ikke isHot/hotSetBy.
  const hot = kunde as any;

  const n = noegletal(kunde.customerProducts);
  const prio = kunde.priority ? PRIORITET[kunde.priority] : null;
  const konf = kunde.sizeConfidence ? KONFIDENS[kunde.sizeConfidence] : null;
  const ks = findKundestatus(kunde.customerStatus);
  const nu = new Date();

  const aabneSager = kunde.tickets.filter((t) => AABNE_SAGSSTATUS.includes(t.status as any));
  const aktiveKort = kunde.hourBundles.map((k) => ({ k, s: kortstatus(k, nu) })).filter(({ k, s }) => k.isActive && !s.udloebet);
  const restMin = aktiveKort.reduce((sum, { s }) => sum + Math.max(0, s.restMin), 0);

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
            {hot.isHot && (
              <span
                title={hot.hotSetBy ? `Markeret Hot af ${hot.hotSetBy}` : "Markeret Hot"}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-600"
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
          <form action={skiftHot.bind(null, kunde.id, !hot.isHot)}>
            <Button
              variant={hot.isHot ? "primary" : "secondary"}
              size="sm"
              type="submit"
              title={hot.isHot ? "Fjern Hot-markering" : "Marker Hot — mulighed for at hente flere timer"}
              className={hot.isHot ? "!bg-orange-500 hover:!bg-orange-600 !text-white !border-orange-500" : ""}
            >
              <Flame className="h-3.5 w-3.5" /> {hot.isHot ? "Hot" : "Marker Hot"}
            </Button>
          </form>
          <Link href={`/kunder/${kunde.id}/rediger`}><Button variant="secondary" size="sm">Rediger</Button></Link>
          <Link href={`/kunder/${kunde.id}/slet`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger">
              <Trash2 className="h-3.5 w-3.5" /> Slet
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Licenser</div>
          <div className="mt-1 text-2xl font-semibold tabular">{n.aktive} / {n.seats}</div>
          <div className={cn("mt-0.5 text-xs tabular", n.fuld ? "text-danger font-medium" : "text-muted-foreground")}>
            {procent(n.udnyttelse)}{n.ledige < 0 ? " — overforbrug" : n.ledige === 0 ? " — ingen ledige" : ` · ${n.ledige} ledige`}
          </div>
        </div>
        <div className="bg-card border border-primary/40 bg-primary/[0.04] rounded-xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Årlig licensværdi</div>
          <div className="mt-1 text-2xl font-semibold tabular text-primary">{n.aarsvaerdi > 0 ? kroner(n.aarsvaerdi) : "–"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{n.udenPris > 0 ? "pakke mangler pris" : "på nuværende licenser"}</div>
        </div>
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

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] items-start">
        {/* Venstre: det du arbejder med */}
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Teknik"
              description="Sager og klippekort på denne kunde."
              action={
                <div className="flex items-center gap-2">
                  <Link href={`/teknik/sager/ny?kunde=${kunde.id}`}>
                    <Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Ny sag</Button>
                  </Link>
                  <Link href="/teknik/klippekort" className="text-xs font-medium text-primary hover:underline">Klippekort</Link>
                </div>
              }
            />
            <CardBody className="p-0">
              {kunde.tickets.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen sager" icon={LifeBuoy} description="Opret en når kunden melder noget ind." /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {kunde.tickets.slice(0, 8).map((t) => {
                    const p = findSagsprioritet(t.priority);
                    const st = findSagsstatus(t.status);
                    return (
                      <li key={t.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/teknik/sager/${t.id}`} className="text-sm font-medium hover:text-primary block truncate">{t.title}</Link>
                          <div className="text-xs text-muted-foreground tabular">
                            {sagsnummer(t.number)} · {alderTekst(alderIDage(t.createdAt, nu))}
                            {t.dueAt && <> · frist {datoKort(t.dueAt)}</>}
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
              {kunde.hourBundles.length > 0 && (
                <div className="px-5 py-3 border-t border-border flex flex-wrap gap-3">
                  {kunde.hourBundles.map((k) => {
                    const s = kortstatus(k, nu);
                    return (
                      <span key={k.id} className={cn("inline-flex items-center gap-2 text-xs rounded-lg border border-border px-2.5 py-1.5", (!k.isActive || s.udloebet) && "opacity-60")}>
                        <Scissors className="h-3 w-3 text-muted-foreground" />
                        <span className="tabular">{kortnummer(k.number)}</span>
                        <span className={cn("tabular", s.restMin <= 0 ? "text-danger font-medium" : "text-muted-foreground")}>
                          {varighed(Math.max(0, s.restMin))} tilbage
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Salgsmuligheder" description="Skift stadie direkte her — dine egne scopes." />
            <CardBody className="p-0">
              {kunde.deals.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen sager" description="Opret en når du har besluttet et scope." /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {kunde.deals.map((d) => {
                    const vaerdi = d.value ?? (d.seatDelta && d.product?.pricePerUserMonth ? d.seatDelta * d.product.pricePerUserMonth * 12 : null);
                    return (
                      <li key={d.id} className="px-5 py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{d.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {d.probability} %
                            {d.seatDelta ? ` · ${d.seatDelta} licenser` : ""}
                            {d.product ? ` · ${d.product.name}` : ""}
                            {vaerdi != null ? ` · ${kroner(vaerdi)}/år` : ""}
                          </div>
                          {d.notes && <p className="text-xs text-muted-foreground mt-1.5 max-w-prose">{d.notes}</p>}
                          <GemtAf af={d.updatedBy} tid={d.updatedAt} className="mt-1.5" />
                        </div>
                        <GemValg
                          action={async (fd: FormData) => {
                            "use server";
                            const valgt = fd.get("stage");
                            if (typeof valgt === "string" && valgt && valgt !== d.stage) await flytStadie(d.id, valgt);
                          }}
                          name="stage"
                          value={d.stage}
                          options={STADIER}
                          ariaLabel={`Stadie for ${d.title}`}
                          selectClassName="h-8 text-xs w-40"
                          className="shrink-0"
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <form action={opretSalgssag} className="px-5 py-4 border-t border-border grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <input type="hidden" name="companyId" value={kunde.id} />
                <div className="col-span-2"><Label htmlFor="dt">Titel</Label><Input id="dt" name="title" required placeholder="fx Opgradering til Medium" /></div>
                <div><Label htmlFor="dd">Licenser</Label><Input id="dd" name="seatDelta" type="number" min={0} /></div>
                <div>
                  <Label htmlFor="dp">Pakke</Label>
                  <Select id="dp" name="productId" defaultValue="">
                    <option value="">Ingen</option>
                    <LicensOptions grupper={grupper} />
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ds">Stadie</Label>
                  <Select id="ds" name="stage" defaultValue="ny">
                    {STADIER.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-5 flex justify-end"><Button size="sm" type="submit">Opret sag</Button></div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pakke og licenser" description="Vælg pakke, ret antal licenser, og sæt en aftalt pris hvis kunden ikke kører på listeprisen." />
            <CardBody className="flex flex-col gap-4">
              {kunde.customerProducts.map((l) => {
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
                        <Badge variant="muted">{subNr(l.subNumber)}</Badge>
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
                      <Button size="sm" variant="ghost" type="submit" formAction={async () => { "use server"; await sletLicenslinje(l.id); }} className="text-xs text-muted-foreground">
                        Fjern linje
                      </Button>
                      <div className="flex items-center gap-3">
                        <GemtAf af={l.updatedBy} tid={l.updatedAt} />
                        <Button size="sm" type="submit">Gem</Button>
                      </div>
                    </div>
                  </form>
                );
              })}
              <details className="rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">Tilføj pakke</summary>
                <form action={gemLicenslinje.bind(null, kunde.id)} className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="col-span-2">
                    <Label htmlFor="np">Pakke</Label>
                    <Select id="np" name="productId" required>
                      <LicensOptions grupper={grupper} />
                    </Select>
                  </div>
                  <div><Label htmlFor="ns">Tildelte</Label><Input id="ns" name="seats" type="number" min={0} defaultValue={1} /></div>
                  <div><Label htmlFor="na">Aktive</Label><Input id="na" name="activeSeats" type="number" min={0} defaultValue={0} /></div>
                  <div className="col-span-2 sm:col-span-4 flex justify-end"><Button size="sm" type="submit">Tilføj</Button></div>
                </form>
              </details>
            </CardBody>
          </Card>

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
              <form action={registrerLicensaendring.bind(null, kunde.id)} className="px-5 py-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end border-b border-border">
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
              </form>

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
                              <button type="submit" title="Fortryd — sletter posten og sætter licensantallet tilbage" aria-label="Fortryd registrering" className="p-1 rounded text-muted-foreground hover:text-danger">
                                <Undo2 className="h-3.5 w-3.5" />
                              </button>
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
              <div className="flex flex-wrap gap-2">
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
              </div>
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

          <Filboks companyId={kunde.id} filer={filer} forStor={fil === "for-stor"} />
        </div>

        {/* Højre: logbogen først — det er den man skal kunne skrive i uden at lede */}
        <div className="flex flex-col gap-5">
          <Logbog kundeId={kunde.id} poster={kunde.logEntries} />

          <Card>
            <CardHeader
              title="Notater"
              description="Små opgaver på denne kunde. De ligger også på tavlen under Kundenotater."
              action={
                <Link href={`/notater?kunde=${kunde.id}`} className="text-xs font-medium text-primary hover:underline">
                  Åbn tavlen
                </Link>
              }
            />
            <CardBody className="p-0">
              <form action={opretNotat} className="px-5 py-4 border-b border-border grid grid-cols-3 gap-2.5 items-end">
                <input type="hidden" name="companyId" value={kunde.id} />
                <div className="col-span-3">
                  <Input name="title" required placeholder="Hvad skal der ske?" />
                </div>
                <Select name="track" defaultValue="salg" aria-label="Spor" className="h-8 text-xs">
                  {NOTAT_SPOR.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </Select>
                <Select name="priority" defaultValue="normal" aria-label="Prioritet" className="h-8 text-xs">
                  {NOTAT_PRIORITET.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </Select>
                <Button size="sm" type="submit">Tilføj</Button>
              </form>

              {kunde.notes_.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen notater" icon={ListChecks} /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {kunde.notes_.map((no) => {
                    const faerdig = no.completedAt != null;
                    const sp = findSpor(no.track);
                    return (
                      <li key={no.id} className={cn("px-5 py-2.5 flex items-start gap-2.5", faerdig && "opacity-55")}>
                        <form action={skiftFaerdig.bind(null, no.id, !faerdig)} className="shrink-0 pt-0.5">
                          <button
                            type="submit"
                            aria-label={faerdig ? "Genåbn" : "Markér som færdig"}
                            className={cn(
                              "h-4 w-4 rounded border grid place-items-center transition-colors",
                              faerdig ? "bg-primary border-primary text-primary-foreground" : "border-input text-transparent hover:border-primary hover:text-primary"
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </form>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm leading-snug", faerdig && "line-through text-muted-foreground")}>{no.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                              style={{ background: faerdig ? "#94A3B8" : sp.bg }}
                            >
                              {sp.label}
                            </span>
                            <span>{NOTAT_KOLONNER.find((x) => x.key === no.lane)?.label ?? no.lane}</span>
                            {no.priority === "hoej" && !faerdig && <span className="text-danger font-medium">Høj</span>}
                            {no.dueAt && <span className="tabular">{datoKort(no.dueAt)}</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <KundestatusKort
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
                      <form action={sletKontakt.bind(null, c.id, kunde.id)}>
                        <button type="submit" aria-label={`Slet ${c.firstName}`} className="text-muted-foreground hover:text-danger p-1 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <details className="px-5 py-4 border-t border-border">
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
              </details>
            </CardBody>
          </Card>
        </div>
      </div>
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
