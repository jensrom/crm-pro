import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowUpCircle, Boxes, ExternalLink, FileText, KeyRound, PackagePlus, RefreshCw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GruppeFlueben } from "@/components/dokumenter/GruppeFlueben";
import { PeriodeFelter, type SynkMaal } from "@/components/dokumenter/PeriodeFelter";
import { db } from "@/lib/db";
import { ANTAL_FRIE_LINJER, brugerensProfilId, subNr, noegleNr } from "@/lib/dokumenter";
import { kraevSkriv } from "@/lib/auth";
import { erEngang, hentKatalog, licensmodel, listepris } from "@/lib/katalog";
import { KundeVaelger } from "@/components/dokumenter/KundeVaelger";
import { aftaleUdloeb, dagTekst, fornyelsesPeriode, isoDag, plusDage } from "@/lib/perioder";
import { opretOrdre } from "@/app/actions/ordrer";
import { TilkoebRaekke } from "@/components/dokumenter/TilkoebRaekke";
import { forskelligeUdloeb, kontraktTerm, kontraktUdloeb } from "@/lib/kontrakter";
import { ejedePakker, hoejerePakker, produktNoegle, tilladteGrupper } from "@/lib/pakker";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  modtager: "Dokumentet skal have en modtager.",
  linjer: "Sæt flueben ved mindst én fornyelse eller licens, eller skriv en fri linje.",
  udloebet: "SUB-nøglen er udløbet før tilkøbets startdato. Forny nøglen først, eller ret startdatoen.",
  salesforce: "Salesforce-linket skal være en fuld adresse, der starter med https://",
  pakke: "Kunden har en anden pakke af det produkt. Tilkøb sker på den pakke, kunden ejer — brug Opgradering af aftale for at skifte pakke.",
  opgradering: "Vælg den pakke, aftalen skal opgraderes til.",
};

/**
 * Nyt tilbud eller ny ordrebekræftelse.
 *   ?kunde=<id>          forudfylder modtager og viser kundens aftaler
 *   ?forny=<id>,<id>|alle  forvælger fornyelse af de licenslinjer
 *   ?fornyProdukt=<id>   forvælger fornyelse af alle kundens licenser under et produkt
 *   ?kontrakt=<id>       tilkøb på en SUB-nøgle: restpris frem til nøglens udløb
 *   ?opgrader=<id>       forvælger opgradering af den licenslinje
 *   ?type=tilbud|ordre
 */
export default async function NyOrdre({
  searchParams,
}: {
  searchParams: Promise<{ kunde?: string; fejl?: string; forny?: string; fornyProdukt?: string; type?: string; kontrakt?: string; opgrader?: string }>;
}) {
  const { kunde: kundeId, fejl, forny, fornyProdukt, type, kontrakt: kontraktId, opgrader } = await searchParams;
  const nu = new Date();
  const fornyelse = !!(forny || fornyProdukt);
  const opgradering = !!opgrader;
  const kind = type === "tilbud" ? "tilbud" : type === "ordre" ? "ordre" : fornyelse ? "ordre" : "tilbud";

  const [kunder, kunde, { familier, uplacerede }] = await Promise.all([
    db.company.findMany({ where: { isActive: true }, select: { id: true, name: true, department: true, customerNumber: true }, orderBy: [{ name: "asc" }, { department: "asc" }] }),
    kundeId
      ? db.company.findUnique({
          where: { id: kundeId },
          include: {
            customerProducts: {
              where: { isActive: true },
              include: { product: { include: { family: true } }, contract: { select: { subNumber: true } } },
              orderBy: [{ contract: { subNumber: "asc" } }, { createdAt: "asc" }],
            },
            contacts: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }], take: 1 },
          },
        })
      : null,
    hentKatalog({ kunAktive: true }),
  ]);
  const mig = await kraevSkriv("salg");
  const [profiler, minProfil] = await Promise.all([
    db.senderProfile.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, department: true } }),
    brugerensProfilId(mig.id),
  ]);

  // Tilkøb på en SUB-nøgle
  const kontrakt =
    kunde && kontraktId
      ? await db.contract.findFirst({
          where: { id: kontraktId, companyId: kunde.id },
          include: { lines: { where: { isActive: true }, include: { product: { include: { family: true } } }, orderBy: { createdAt: "asc" } } },
        })
      : null;
  const kUdloeb = kontrakt ? kontraktUdloeb(kontrakt.lines, nu) : null;
  const kSkaev = kontrakt ? forskelligeUdloeb(kontrakt.lines, nu) : false;

  // Kun den pakke kunden ejer af et produkt kan vælges — et skift af pakke er en opgradering
  const pakker = ejedePakker(kunde?.customerProducts ?? []);
  const grupper = tilladteGrupper(
    [
      ...familier.map((f) => ({ id: f.id, navn: f.name, licenser: f.products })),
      ...(uplacerede.length ? [{ id: "uden", navn: "Uden produkt", licenser: uplacerede }] : []),
    ].filter((g) => g.licenser.length > 0),
    pakker
  );
  const alleLicenser = [...familier.flatMap((f) => f.products), ...uplacerede];
  // Linjer der kan opgraderes til en højere pakke af samme produkt
  const opgraderbare = (kunde?.customerProducts ?? [])
    .map((l) => ({ l, til: hoejerePakker(l.product, alleLicenser) }))
    .filter((x) => x.til.length > 0);

  // Kundens løbende abonnementer — dem der kan fornyes
  const aftaler = (kunde?.customerProducts ?? []).filter((l) => l.product.licenseModel !== "perpetual");
  const fornyValgt = new Set(
    forny === "alle"
      ? aftaler.map((l) => l.id)
      : fornyProdukt
        ? aftaler.filter((l) => (l.product.familyId ?? "uden") === fornyProdukt).map((l) => l.id)
        : (forny ?? "").split(",").filter(Boolean)
  );

  // Synk-mål for nye licenser: kundens aftale på samme licens, ellers på samme produkt
  const synkFor = (productId: string, familyId: string | null): SynkMaal[] => {
    const egen = aftaler.find((l) => l.productId === productId);
    const famlie = egen ?? aftaler.find((l) => (l.product.familyId ?? null) === familyId);
    if (!famlie) return [];
    const udloeb = aftaleUdloeb(famlie, nu);
    const naeste = fornyelsesPeriode(famlie, nu).til;
    const navn = egen ? "aftalen" : `${famlie.product.family?.name ?? famlie.product.name}-aftalen`;
    return [
      { label: `Synk til ${navn}`, slut: isoDag(udloeb) },
      { label: "Synk + næste periode", slut: isoDag(naeste) },
    ];
  };

  const kontakt = kunde?.contacts[0];
  const adresse = kunde
    ? [kunde.department, kunde.address, [kunde.zipCode, kunde.city].filter(Boolean).join(" "), kunde.country !== "Danmark" ? kunde.country : null].filter(Boolean).join("\n")
    : "";
  const standardIntro = opgradering
    ? kind === "tilbud"
      ? "Hermed fremsendes tilbud på opgradering af jeres aftale for %KUNDENAVN%. Merprisen er beregnet for restperioden frem til aftalens udløb."
      : "Hermed bekræftes opgradering af jeres aftale for %KUNDENAVN%. Merprisen er afregnet for restperioden frem til aftalens udløb."
    : kontrakt
    ? kind === "tilbud"
      ? `Hermed fremsendes tilbud på tilkøb til jeres aftale ${subNr(kontrakt.subNumber)} for %KUNDENAVN%. De nye licenser følger den eksisterende aftale, så prisen er beregnet for restperioden frem til aftalens udløb.`
      : `Hermed bekræftes tilkøb til jeres aftale ${subNr(kontrakt.subNumber)} for %KUNDENAVN%. De nye licenser følger den eksisterende aftale og er afregnet for restperioden frem til aftalens udløb.`
    : fornyelse
    ? kind === "tilbud"
      ? "Hermed fremsendes tilbud på fornyelse af jeres aftale for %KUNDENAVN%."
      : "Hermed bekræftes fornyelse af jeres aftale for %KUNDENAVN%."
    : "";

  const qs = (t: string) =>
    `/ordrer/ny?type=${t}${kunde ? `&kunde=${kunde.id}` : ""}${forny ? `&forny=${forny}` : ""}${fornyProdukt ? `&fornyProdukt=${fornyProdukt}` : ""}${kontrakt ? `&kontrakt=${kontrakt.id}` : ""}${opgrader ? `&opgrader=${opgrader}` : ""}`;

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <div>
        <Link href={kunde ? `/kunder/${kunde.id}` : "/ordrer"} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {kunde ? kunde.name : "Ordreliste"}
        </Link>
        <h1 className="mt-1.5 text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" /> {kind === "tilbud" ? "Nyt tilbud" : "Ny ordrebekræftelse"}
          {fornyelse && <Badge variant="info"><RefreshCw className="h-3 w-3 mr-1 inline" />Fornyelse</Badge>}
          {kontrakt && <Badge variant="info"><KeyRound className="h-3 w-3 mr-1 inline" />Tilkøb på {subNr(kontrakt.subNumber)}</Badge>}
          {opgradering && <Badge variant="info"><ArrowUpCircle className="h-3 w-3 mr-1 inline" />Opgradering</Badge>}
        </h1>
      </div>

      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />{FEJL[fejl]}</CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <Link href={qs("tilbud")} className={kind === "tilbud" ? "px-3 py-1.5 bg-primary text-primary-foreground" : "px-3 py-1.5 hover:bg-secondary"}>Tilbud</Link>
            <Link href={qs("ordre")} className={kind === "ordre" ? "px-3 py-1.5 bg-primary text-primary-foreground" : "px-3 py-1.5 hover:bg-secondary"}>Ordrebekræftelse</Link>
          </div>
          <KundeVaelger kunder={kunder} valgt={kunde?.id ?? null} kind={kind} />
        </CardBody>
      </Card>

      <form key={kunde?.id ?? "ingen"} action={opretOrdre} className="flex flex-col gap-5">
        <input type="hidden" name="kind" value={kind} />
        {kunde && <input type="hidden" name="companyId" value={kunde.id} />}
        {kontrakt && <input type="hidden" name="contractId" value={kontrakt.id} />}

        <Card>
          <CardHeader title="Modtager" />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div><Label htmlFor="rn">Firma / navn</Label><Input id="rn" name="recipientName" required defaultValue={kunde?.name ?? ""} /></div>
            <div><Label htmlFor="ra">Att. (deres ref.)</Label><Input id="ra" name="recipientAttn" defaultValue={kontakt ? `${kontakt.firstName} ${kontakt.lastName}`.trim() : ""} /></div>
            <div><Label htmlFor="rd">Adresse</Label><Textarea id="rd" name="recipientAddress" defaultValue={adresse} className="min-h-[70px]" /></div>
            <div className="flex flex-col gap-4">
              <div><Label htmlFor="re">Mail</Label><Input id="re" name="recipientEmail" type="email" defaultValue={kontakt?.email ?? kunde?.email ?? ""} /></div>
              <div><Label htmlFor="rr">Deres rekv. nr. / PO</Label><Input id="rr" name="reference" /></div>
              <div>
                <Label htmlFor="sf" hint="kopiér adressen på Opportunity'en">Salesforce-link</Label>
                <Input id="sf" name="salesforceUrl" type="url" inputMode="url" placeholder="https://….lightning.force.com/lightning/r/Opportunity/006…/view" />
              </div>
              {profiler.length > 0 && (
                <div>
                  <Label htmlFor="sp">Afsender (afdeling)</Label>
                  <Select id="sp" name="senderProfileId" defaultValue={minProfil ?? ""}>
                    <option value="">Fælles afsenderoplysninger</option>
                    {profiler.map((p) => <option key={p.id} value={p.id}>{p.department ? `${p.name} — ${p.department}` : p.name}</option>)}
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">Navn, mail og telefon på sælgeren er dine egne fra Brugere.</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="od">{kind === "tilbud" ? "Tilbudsdato" : "Ordredato"}</Label><Input id="od" name="orderDate" type="date" defaultValue={isoDag(nu)} /></div>
              {kind === "tilbud" && (
                <div><Label htmlFor="vu">Gyldigt til</Label><Input id="vu" name="validUntil" type="date" defaultValue={isoDag(plusDage(nu, 30))} /></div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="in">Indledning (%KUNDENAVN% erstattes med modtageren)</Label>
              <Textarea id="in" name="intro" defaultValue={standardIntro} className="min-h-[70px]" placeholder="fx Herved bekræftes levering af …" />
            </div>
          </CardBody>
        </Card>

        {kontrakt && (
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><PackagePlus className="h-4 w-4" />Tilkøb på {subNr(kontrakt.subNumber)}{kontrakt.name ? ` · ${kontrakt.name}` : ""}</span>}
              description={
                kUdloeb
                  ? `Nøglen udløber ${dagTekst(kUdloeb)} (aftale ${kontraktTerm(kontrakt.lines)} mdr.). Tilkøb afregnes fra startdatoen til udløbet — påbegyndte måneder tæller som hele. Prisen er nøglens aftalte pris; ret den, hvis tilbuddet skal have en anden.`
                  : "Nøglen har ingen løbende abonnementer, så tilkøb afregnes som engangskøb."
              }
            />
            <CardBody className="p-0">
              {kSkaev && (
                <div className="mx-5 mb-3 rounded-lg bg-warning/[0.1] px-3 py-2 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                  Licenserne på nøglen har forskellige udløb. Tilkøb af en licens nøglen allerede har, følger den licens; nye licenser følger det seneste udløb.
                </div>
              )}
              <div className="hidden lg:grid grid-cols-[auto_1fr_70px_100px_minmax(300px,1.3fr)] gap-x-3 px-5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="w-4" /><span /><span>Antal</span><span>Pris</span><span>Start → udløb · beløb</span>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {kontrakt.lines.map((l) => {
                  const engang = erEngang(l.product.licenseModel);
                  const pris = engang ? listepris(l.product) : l.unitPriceMonth ?? listepris(l.product);
                  return (
                    <TilkoebRaekke
                      key={l.id}
                      productId={l.productId}
                      navn={l.product.name}
                      info={`Nøglen har ${l.seats} · ${engang ? licensmodel(l.product.licenseModel).label : l.unitPriceMonth != null ? "aftalt pris" : "listepris"}`}
                      pris={pris}
                      engang={engang}
                      udloeb={engang ? null : isoDag(aftaleUdloeb(l, nu))}
                      start={isoDag(nu)}
                      valgt={kontrakt.lines.length === 1}
                    />
                  );
                })}
              </ul>
              <details className="border-t border-border">
                <summary className="cursor-pointer px-5 py-2.5 text-sm font-medium text-primary">Tilføj en anden licens til nøglen</summary>
                <ul className="divide-y divide-border border-t border-border">
                  {grupper.flatMap((g) =>
                    g.licenser
                      .filter((p) => !kontrakt.lines.some((l) => l.productId === p.id))
                      // En nøgle hører til ét produkt
                      .filter((p) => kontrakt.lines.length === 0 || kontrakt.lines.every((l) => produktNoegle(l.product) === produktNoegle(p)))
                      .map((p) => (
                        <TilkoebRaekke
                          key={p.id}
                          productId={p.id}
                          navn={g.id === "uden" ? p.name : `${g.navn} · ${p.name}`}
                          info={`${licensmodel(p.licenseModel).label} · listepris`}
                          pris={listepris(p)}
                          engang={erEngang(p.licenseModel)}
                          udloeb={kUdloeb ? isoDag(kUdloeb) : null}
                          start={isoDag(nu)}
                        />
                      ))
                  )}
                </ul>
              </details>
            </CardBody>
          </Card>
        )}

        {!kontrakt && kunde && opgraderbare.length > 0 && (
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4" />Opgradering af aftale</span>}
              description="Flytter aftalen til en højere pakke af samme produkt. Merprisen pr. bruger pr. md. afregnes fra startdatoen til aftalens udløb — tom pris = forskellen mellem pakkernes priser. Når ordren lægges på kunden, skifter linjen pakke med samme SUB-nøgle og udløb, og fremover kan der kun tilkøbes på den nye pakke."
            />
            <CardBody className="p-0">
              <div className="hidden lg:grid grid-cols-[auto_1fr_minmax(180px,0.8fr)_70px_100px_150px] gap-x-3 px-5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="w-4" /><span /><span>Ny pakke</span><span>Antal</span><span>Merpris/md.</span><span>Start</span>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {opgraderbare.map(({ l, til }) => {
                  const nuPris = l.unitPriceMonth ?? l.product.pricePerUserMonth ?? 0;
                  return (
                    <li key={l.id} className="px-5 py-3 grid grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_1fr_minmax(180px,0.8fr)_70px_100px_150px] gap-x-3 gap-y-2 items-start">
                      <input type="checkbox" name="opgrader" value={l.id} defaultChecked={opgrader === l.id} aria-label={`Opgradér ${l.product.name}`} className="mt-2 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                      <div className="min-w-0 pt-1">
                        <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                          {l.product.name}
                          <Badge variant="muted">{noegleNr(l)}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Udløber {dagTekst(aftaleUdloeb(l, nu))} · {l.seats} licenser · {nuPris} kr. pr. bruger/md. nu
                        </div>
                      </div>
                      <Select name={`o_til_${l.id}`} defaultValue={til[0].id} aria-label="Ny pakke" className="h-8 text-xs col-start-2 lg:col-start-auto">
                        {til.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.pricePerUserMonth != null ? ` · ${p.pricePerUserMonth} kr. (+${Math.max(0, p.pricePerUserMonth - nuPris)})` : ""}
                          </option>
                        ))}
                      </Select>
                      <Input name={`o_antal_${l.id}`} type="number" min={1} defaultValue={l.seats} aria-label="Antal" className="h-8 text-xs col-start-2 lg:col-start-auto" />
                      <Input name={`o_pris_${l.id}`} inputMode="decimal" placeholder="forskel" aria-label="Merpris pr. md." className="h-8 text-xs col-start-2 lg:col-start-auto" />
                      <Input name={`o_${l.id}_start`} type="date" defaultValue={isoDag(nu)} aria-label="Start" className="h-8 text-xs col-start-2 lg:col-start-auto" />
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}

        {!kontrakt && kunde && aftaler.length > 0 && (
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" />Fornyelse af kundens aftaler</span>}
              description="Perioden starter dagen efter aftalens udløb og løber en aftaleperiode frem. Ret antal, pris eller måneder, hvis aftalen ændres."
            />
            <CardBody className="p-0">
              <div className="hidden lg:grid grid-cols-[auto_1fr_70px_100px_minmax(330px,1.4fr)] gap-x-3 px-5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="w-4" /><span /><span>Antal</span><span>Pris/md.</span><span>Start · mdr. · slut</span>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {aftaler.map((l) => {
                  const p = fornyelsesPeriode(l, nu);
                  const pris = l.unitPriceMonth ?? l.product.pricePerUserMonth;
                  return (
                    <li key={l.id} className="px-5 py-3 grid grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_1fr_70px_100px_minmax(330px,1.4fr)] gap-x-3 gap-y-2 items-start">
                      <input type="checkbox" name="forny" value={l.id} defaultChecked={fornyValgt.has(l.id)} aria-label={`Forny ${l.product.name}`} className="mt-2 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                      <div className="min-w-0 pt-1">
                        <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                          {l.product.family && !l.product.name.toLowerCase().startsWith(l.product.family.name.toLowerCase()) ? `${l.product.family.name} · ` : ""}{l.product.name}
                          <Badge variant="muted">{noegleNr(l)}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Udløber {dagTekst(aftaleUdloeb(l, nu))} · aftale {l.termMonths} mdr. · {l.seats} licenser
                        </div>
                      </div>
                      <Input name={`f_antal_${l.id}`} type="number" min={1} defaultValue={l.seats} aria-label="Antal" className="h-8 text-xs col-start-2 lg:col-start-auto" />
                      <Input name={`f_pris_${l.id}`} inputMode="decimal" defaultValue={pris ?? ""} aria-label="Pris pr. md." className="h-8 text-xs col-start-2 lg:col-start-auto" />
                      <div className="col-start-2 lg:col-start-auto">
                        <PeriodeFelter prefix={`f_${l.id}_`} start={isoDag(p.fra)} maaneder={p.maaneder} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        )}

        {!kontrakt && (
        <Card>
          <CardHeader
            title="Nye licenser, tilkøb og ydelser"
            description="Sæt flueben ved et produkt for at tage alle licenserne under det med, eller vælg dem enkeltvis. Subscription afregnes som antal × pris pr. md. × måneder. Engangsydelser afregnes som antal × pris. Brug synk-knapperne, så en ekstra licens følger kundens eksisterende aftale."
          />
          <CardBody className="p-0">
            <div className="hidden lg:grid grid-cols-[auto_1fr_70px_100px_minmax(330px,1.4fr)] gap-x-3 px-5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="w-4" /><span /><span>Antal</span><span>Pris</span><span>Start · mdr. · slut</span>
            </div>
            {grupper.map((g) => (
              <div key={g.id} className="border-t border-border">
                <label className="flex items-center gap-2.5 px-5 py-2.5 bg-secondary/40 text-sm font-semibold">
                  <GruppeFlueben gruppe={g.id} label={`Alle licenser under ${g.navn}`} />
                  <Boxes className="h-4 w-4" /> {g.navn}
                </label>
                <ul className="divide-y divide-border">
                  {g.licenser.map((p) => {
                    const kl = aftaler.find((l) => l.productId === p.id) ?? kunde?.customerProducts.find((l) => l.productId === p.id) ?? null;
                    const perpetual = erEngang(p.licenseModel);
                    const pris = perpetual ? listepris(p) : kl?.unitPriceMonth ?? listepris(p);
                    return (
                      <li key={p.id} className="px-5 py-3 grid grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_1fr_70px_100px_minmax(330px,1.4fr)] gap-x-3 gap-y-2 items-start">
                        <input type="checkbox" name="vaelg" value={p.id} data-gruppe={g.id} aria-label={`Medtag ${p.name}`} className="mt-2 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                        <div className="min-w-0 pt-1">
                          <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                            {p.name}
                            {kl && <Badge variant="info">Kunden har {kl.seats}</Badge>}
                            {kl?.unitPriceMonth != null && !perpetual && <Badge variant="muted">Aftalt pris</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{licensmodel(p.licenseModel).label} · {licensmodel(p.licenseModel).enhed}</div>
                        </div>
                        <Input name={`antal_${p.id}`} type="number" min={1} defaultValue={1} aria-label="Antal" className="h-8 text-xs col-start-2 lg:col-start-auto" />
                        <Input name={`pris_${p.id}`} inputMode="decimal" defaultValue={pris ?? ""} placeholder="pris" aria-label="Pris" className="h-8 text-xs col-start-2 lg:col-start-auto" />
                        <div className="col-start-2 lg:col-start-auto">
                          {perpetual ? (
                            <span className="text-xs text-muted-foreground leading-8">Engangskøb — ingen periode</span>
                          ) : (
                            <PeriodeFelter prefix={`n_${p.id}_`} start={isoDag(nu)} maaneder={kl?.termMonths ?? 12} synk={synkFor(p.id, p.familyId)} />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>
        )}

        <Card>
          <CardHeader title="Frie positioner" description="Fx klippekort, opsætning eller kursus. Udfyld måneder for et abonnement — tomt = engangsbeløb." />
          <CardBody className="flex flex-col gap-4">
            {Array.from({ length: ANTAL_FRIE_LINJER }, (_, i) => (
              <div key={i} className="grid gap-2 lg:grid-cols-[1fr_70px_100px_minmax(330px,1.4fr)] items-start border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex flex-col gap-2">
                  <Input name={`fri_tekst_${i}`} placeholder="Overskrift, fx Konsulentassistance klippekort" aria-label="Overskrift" />
                  <Textarea name={`fri_detaljer_${i}`} placeholder="Beskrivelse (valgfri)" aria-label="Beskrivelse" className="min-h-[54px] text-xs" />
                </div>
                <Input name={`fri_antal_${i}`} type="number" min={1} placeholder="Antal" aria-label="Antal" className="h-8 text-xs" />
                <Input name={`fri_pris_${i}`} inputMode="decimal" placeholder="Pris" aria-label="Pris" className="h-8 text-xs" />
                <PeriodeFelter prefix={`fri_${i}_`} start="" maaneder={null} />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-4">
            <div>
              <Label htmlFor="no">Bemærkninger</Label>
              <Textarea id="no" name="note" className="min-h-[60px]" placeholder="fx Bemærk at OPC-routeren skal afvikles på kundens egne servere." />
            </div>
            {kunde && kind === "ordre" && (
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="opdater" value="1" defaultChecked className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                <span>
                  Opdatér kundens aftaler
                  <span className="block text-xs text-muted-foreground">
                    {kontrakt
                      ? `Tilkøbet lægges på ${subNr(kontrakt.subNumber)} med nøglens udløb. Engangsydelser og frie positioner rører ikke kunden.`
                      : "Fornyelser flytter aftalens udløb til periodens slutdato. Tilkøb lægges på kundens licens. Opgraderinger flytter linjen til den nye pakke. Engangsydelser og frie positioner rører ikke kunden."}
                  </span>
                </span>
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              {kunde
                ? "PDF'en gemmes i kundens filboks og noteres i logbogen. Betingelser kommer fra de produkter, der er med."
                : "Uden kunde gemmes dokumentet kun i ordrelisten."}
            </p>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href={kunde ? `/kunder/${kunde.id}` : "/ordrer"}><Button type="button" variant="secondary">Fortryd</Button></Link>
          <Button type="submit"><FileText className="h-4 w-4" /> {kind === "tilbud" ? "Opret tilbud" : "Opret ordrebekræftelse"}</Button>
        </div>
      </form>
    </div>
  );
}
