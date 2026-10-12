import Link from "next/link";
import {
  Activity as AktivitetIkon, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Plus, RotateCcw, Trash2, X,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GemtAf } from "@/components/ui/gemt-af";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LicensOptions, type LicensGruppe } from "@/components/produkter/LicensOptions";
import { flytStadie, opdaterSag, opretSag, sletSag } from "@/app/actions/salg";
import {
  AABNE_STADIER, dageSiden, dageTilOprydning, delPipeline, naboStadier, sagsVaerdi, stadieLabel,
} from "@/lib/pipeline";
import { datoKort, kroner, tal, tidspunkt } from "@/lib/format";
import { isoDato } from "@/lib/dokumenter";
import { cn } from "@/lib/utils";

type Sag = {
  id: string;
  title: string;
  stage: string;
  probability: number;
  seatDelta: number | null;
  value: number | null;
  productId: string | null;
  product: { id: string; name: string; pricePerUserMonth: number | null } | null;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  stageChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
  notes: string | null;
  nextStep: string | null;
  lostReason: string | null;
};

type Bevaegelse = { id: string; content: string; author: string | null; createdAt: Date };

/** Farveprik pr. kolonne — dæmpet, så boardet ikke råber. */
const KOLONNEFARVE: Record<string, string> = {
  ny: "bg-muted-foreground/40",
  kvalificeret: "bg-info/70",
  tilbud: "bg-warning/70",
  forhandling: "bg-primary/70",
  afsluttet: "bg-success/70",
};

export function Statusboard({
  kundeId,
  sager,
  grupper,
  dage,
  visRyddede,
  bevaegelser,
  kanSkrive = true,
  kanOpretteLead = true,
}: {
  kundeId: string;
  sager: Sag[];
  grupper: LicensGruppe[];
  dage: number;
  visRyddede: boolean;
  bevaegelser: Bevaegelse[];
  /** Skriveadgang til salg: flytte, redigere, slette og oprette opportunities */
  kanSkrive?: boolean;
  /** Må oprette leads (også en ren Sælger) */
  kanOpretteLead?: boolean;
}) {
  const nu = new Date();
  const { aabne, afsluttet, ryddet } = delPipeline(sager, dage, nu);

  const licenserISpil = aabne.reduce((s, d) => s + (d.seatDelta ?? 0), 0);
  const samlet = aabne.reduce((s, d) => s + (sagsVaerdi(d) ?? 0), 0);
  const vaegtet = aabne.reduce((s, d) => s + ((sagsVaerdi(d) ?? 0) * d.probability) / 100, 0);
  const naesteLuk = aabne
    .filter((d) => d.expectedCloseDate)
    .sort((a, b) => a.expectedCloseDate!.getTime() - b.expectedCloseDate!.getTime())[0];
  const vundetAar = sager.filter((d) => d.stage === "vundet" && d.closedAt && d.closedAt.getFullYear() === nu.getFullYear());

  return (
    <Card>
      <CardHeader
        title="Pipeline"
        description={`Hvad der er i spil på kunden lige nu. Vundne og tabte står som afsluttet i ${dage} ${dage === 1 ? "dag" : "dage"} og ryddes derefter væk.`}
        action={<Link href="/opportunities" className="text-xs font-medium text-primary hover:underline">Alle opportunities</Link>}
      />

      {/* Nøgletal for kundens pipeline */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border border-b border-border">
        <Noegletal label="Åbne muligheder" vaerdi={tal(aabne.length)} sub={`${tal(licenserISpil)} licenser i spil`} />
        <Noegletal label="Samlet årsværdi" vaerdi={samlet > 0 ? kroner(samlet) : "–"} sub="på åbne muligheder" />
        <Noegletal label="Vægtet årsværdi" vaerdi={vaegtet > 0 ? kroner(vaegtet) : "–"} sub="sandsynlighed × værdi" fremhaev />
        <Noegletal
          label="Næste forventede luk"
          vaerdi={naesteLuk ? datoKort(naesteLuk.expectedCloseDate) : "–"}
          sub={naesteLuk ? naesteLuk.title : "ingen dato sat"}
          advarsel={!!naesteLuk && naesteLuk.expectedCloseDate! < nu}
        />
        <Noegletal label={`Vundet i ${nu.getFullYear()}`} vaerdi={tal(vundetAar.length)} sub={`${tal(vundetAar.reduce((s, d) => s + (d.seatDelta ?? 0), 0))} licenser`} />
      </div>

      <CardBody className="flex flex-col gap-5">
        {/* Selve boardet */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {AABNE_STADIER.map((st) => {
            const iKolonne = aabne.filter((d) => d.stage === st.key);
            const sum = iKolonne.reduce((s, d) => s + (sagsVaerdi(d) ?? 0), 0);
            return (
              <Kolonne key={st.key} titel={st.label} farve={KOLONNEFARVE[st.key]} antal={iKolonne.length} sum={sum}>
                {iKolonne.map((d) => <SagsKort key={d.id} sag={d} grupper={grupper} nu={nu} kanSkrive={kanSkrive} />)}
              </Kolonne>
            );
          })}
          <Kolonne titel="Afsluttet" farve={KOLONNEFARVE.afsluttet} antal={afsluttet.length} tom="Intet afsluttet for nylig">
            {afsluttet.map((d) => <AfsluttetKort key={d.id} sag={d} dage={dage} nu={nu} kanSkrive={kanSkrive} />)}
            {ryddet.length > 0 && (
              <Link
                href={visRyddede ? `/kunder/${kundeId}?fane=salg` : `/kunder/${kundeId}?fane=salg&ryddede=1#ryddede`}
                scroll={false}
                className="text-[11px] text-muted-foreground hover:text-primary text-center py-1"
              >
                {visRyddede ? "Skjul ryddede" : `${tal(ryddet.length)} ældre ryddet væk · vis`}
              </Link>
            )}
          </Kolonne>
        </div>

        {visRyddede && ryddet.length > 0 && (
          <div id="ryddede" className="rounded-lg border border-border scroll-mt-24">
            <div className="px-4 py-2.5 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ryddet væk — ældre end {dage} dage
            </div>
            <ul className="divide-y divide-border">
              {ryddet.map((d) => (
                <li key={d.id} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {d.title}
                    <span className="text-xs text-muted-foreground tabular ml-2">
                      {d.closedAt ? datoKort(d.closedAt) : "ukendt dato"}
                      {sagsVaerdi(d) != null && ` · ${kroner(sagsVaerdi(d))}/år`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Badge variant={d.stage === "vundet" ? "success" : "muted"}>{stadieLabel(d.stage)}</Badge>
                    {kanSkrive && <form action={flytStadie.bind(null, d.id, "forhandling")}>
                      <button type="submit" title="Genåbn i Forhandling" aria-label={`Genåbn ${d.title}`} className="p-1 rounded text-muted-foreground hover:text-primary">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </form>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr] items-start">
          {/* Seneste bevægelser */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <AktivitetIkon className="h-3.5 w-3.5" /> Seneste bevægelser
            </h3>
            {bevaegelser.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Ingen bevægelser endnu. Når en mulighed oprettes eller flyttes, står det her og i logbogen.</p>
            ) : (
              <ol className="flex flex-col">
                {bevaegelser.map((b) => (
                  <li key={b.id} className="relative pl-4 py-1.5 border-l border-border">
                    <span className="absolute -left-[3.5px] top-3 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden />
                    <p className="text-sm leading-snug">{b.content}</p>
                    <p className="text-[11px] text-muted-foreground tabular">
                      {tidspunkt(b.createdAt)}{b.author ? ` · ${b.author}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Ny mulighed — en ren Sælger kan kun oprette leads */}
          {kanOpretteLead && <details className="group rounded-lg border border-dashed border-border open:border-solid">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Ny salgsmulighed
              <span className="text-xs text-muted-foreground font-normal">— dit scope, dine tal</span>
            </summary>
            <form action={opretSag} className="px-4 pb-4 grid grid-cols-2 gap-3 items-end">
              <input type="hidden" name="companyId" value={kundeId} />
              <div className="col-span-2"><Label htmlFor="ns-t">Titel</Label><Input id="ns-t" name="title" required placeholder="fx Opgradering til Medium" /></div>
              <div>
                <Label htmlFor="ns-p">Pakke</Label>
                <Select id="ns-p" name="productId" defaultValue="">
                  <option value="">Ingen</option>
                  <LicensOptions grupper={grupper} />
                </Select>
              </div>
              <div><Label htmlFor="ns-l">Licenser</Label><Input id="ns-l" name="seatDelta" type="number" min={0} /></div>
              <div><Label htmlFor="ns-v">Årsværdi (kr.)</Label><Input id="ns-v" name="value" inputMode="decimal" placeholder="tom = beregnes" /></div>
              <div>
                <Label htmlFor="ns-s">Stadie</Label>
                <Select id="ns-s" name="stage" defaultValue="ny">
                  {AABNE_STADIER.filter((s) => kanSkrive || s.key === "ny").map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </Select>
              </div>
              <div><Label htmlFor="ns-e">Forventet luk</Label><Input id="ns-e" name="expectedCloseDate" type="date" /></div>
              <div><Label htmlFor="ns-pr">Sandsynlighed %</Label><Input id="ns-pr" name="probability" type="number" min={0} max={100} placeholder="efter stadie" /></div>
              <div className="col-span-2"><Label htmlFor="ns-n">Næste skridt</Label><Input id="ns-n" name="nextStep" placeholder="fx Send tilbud fredag" /></div>
              <div className="col-span-2 flex justify-end"><Button size="sm" type="submit">Opret</Button></div>
            </form>
          </details>}
        </div>
      </CardBody>
    </Card>
  );
}

function Noegletal({
  label, vaerdi, sub, fremhaev, advarsel,
}: { label: string; vaerdi: React.ReactNode; sub?: React.ReactNode; fremhaev?: boolean; advarsel?: boolean }) {
  return (
    <div className="bg-card px-5 py-3.5 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular truncate", fremhaev && "text-primary", advarsel && "text-danger")}>{vaerdi}</div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function Kolonne({
  titel, farve, antal, sum, tom = "Tom", children,
}: { titel: string; farve: string; antal: number; sum?: number; tom?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 min-w-0 rounded-xl bg-muted/40 p-2.5">
      <header className="flex items-center justify-between gap-2 px-1 pt-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 min-w-0">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", farve)} aria-hidden />
          <span className="truncate">{titel}</span>
        </h3>
        <span className="text-[11px] text-muted-foreground tabular shrink-0">
          {antal}{sum ? ` · ${kroner(sum)}` : ""}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {children}
        {antal === 0 && (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">{tom}</div>
        )}
      </div>
    </section>
  );
}

function IkonKnap({
  action, titel, children, className,
}: { action: (fd: FormData) => void | Promise<void>; titel: string; children: React.ReactNode; className?: string }) {
  return (
    <form action={action}>
      <button
        type="submit"
        title={titel}
        aria-label={titel}
        className={cn("h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-secondary transition-colors", className)}
      >
        {children}
      </button>
    </form>
  );
}

function SagsKort({ sag: d, grupper, nu, kanSkrive }: { sag: Sag; grupper: LicensGruppe[]; nu: Date; kanSkrive: boolean }) {
  const v = sagsVaerdi(d);
  const iStadie = dageSiden(d.stageChangedAt ?? d.createdAt, nu) ?? 0;
  const overskredet = d.expectedCloseDate != null && d.expectedCloseDate < nu;
  const { forrige, naeste } = naboStadier(d.stage);

  return (
    <article className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2 shadow-[0_1px_2px_rgba(20,22,26,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-snug min-w-0 break-words">{d.title}</h4>
        <span className="text-[11px] tabular text-muted-foreground shrink-0">{d.probability} %</span>
      </div>

      <div className="text-xs text-muted-foreground tabular leading-relaxed">
        {v != null ? <span className="text-foreground font-medium">{kroner(v)}/år</span> : "ingen værdi"}
        {d.seatDelta ? ` · ${d.seatDelta} lic.` : ""}
        {d.product ? <span className="block truncate">{d.product.name}</span> : null}
      </div>

      {d.nextStep && (
        <p className="text-xs leading-snug flex items-start gap-1.5 rounded-md bg-primary/[0.05] px-2 py-1.5">
          <ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          <span className="min-w-0">{d.nextStep}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground tabular">
        <span className={cn("inline-flex items-center gap-1", iStadie >= 30 && "text-warning font-medium")} title="Dage i nuværende stadie">
          <Clock className="h-3 w-3" /> {iStadie === 0 ? "i dag" : `${iStadie} d.`}
        </span>
        {d.expectedCloseDate && (
          <span className={cn(overskredet && "text-danger font-medium")} title="Forventet luk">
            luk {datoKort(d.expectedCloseDate)}
          </span>
        )}
      </div>

      {kanSkrive && <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border">
        <div className="flex items-center">
          {forrige ? (
            <IkonKnap action={flytStadie.bind(null, d.id, forrige)} titel={`Tilbage til ${stadieLabel(forrige)}`}>
              <ChevronLeft className="h-4 w-4" />
            </IkonKnap>
          ) : <span className="h-7 w-7" />}
          {naeste && naeste !== "vundet" && (
            <IkonKnap action={flytStadie.bind(null, d.id, naeste)} titel={`Videre til ${stadieLabel(naeste)}`} className="hover:text-primary">
              <ChevronRight className="h-4 w-4" />
            </IkonKnap>
          )}
        </div>
        <div className="flex items-center">
          <IkonKnap action={flytStadie.bind(null, d.id, "vundet")} titel="Markér som vundet" className="hover:text-success">
            <Check className="h-3.5 w-3.5" />
          </IkonKnap>
          <IkonKnap action={flytStadie.bind(null, d.id, "tabt")} titel="Markér som tabt" className="hover:text-danger">
            <X className="h-3.5 w-3.5" />
          </IkonKnap>
        </div>
      </div>}

      {kanSkrive && <details className="group -mx-3 -mb-3 border-t border-border">
        <summary className="cursor-pointer list-none px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
          Rediger detaljer
        </summary>
        <form action={opdaterSag.bind(null, d.id)} className="px-3 pb-3 flex flex-col gap-2">
          <div><Label htmlFor={`t-${d.id}`}>Titel</Label><Input id={`t-${d.id}`} name="title" defaultValue={d.title} required className="h-8 text-xs" /></div>
          <div>
            <Label htmlFor={`p-${d.id}`}>Pakke</Label>
            <Select id={`p-${d.id}`} name="productId" defaultValue={d.productId ?? ""} className="h-8 text-xs">
              <option value="">Ingen</option>
              <LicensOptions grupper={grupper} medtag={d.product} />
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor={`l-${d.id}`}>Licenser</Label><Input id={`l-${d.id}`} name="seatDelta" type="number" min={0} defaultValue={d.seatDelta ?? ""} className="h-8 text-xs" /></div>
            <div><Label htmlFor={`pr-${d.id}`}>Sandsynl. %</Label><Input id={`pr-${d.id}`} name="probability" type="number" min={0} max={100} defaultValue={d.probability} className="h-8 text-xs" /></div>
          </div>
          <div><Label htmlFor={`v-${d.id}`}>Årsværdi (kr.)</Label><Input id={`v-${d.id}`} name="value" inputMode="decimal" defaultValue={d.value ?? ""} placeholder="tom = beregnes" className="h-8 text-xs" /></div>
          <div><Label htmlFor={`e-${d.id}`}>Forventet luk</Label><Input id={`e-${d.id}`} name="expectedCloseDate" type="date" defaultValue={isoDato(d.expectedCloseDate)} className="h-8 text-xs" /></div>
          <div><Label htmlFor={`n-${d.id}`}>Næste skridt</Label><Input id={`n-${d.id}`} name="nextStep" defaultValue={d.nextStep ?? ""} className="h-8 text-xs" /></div>
          <div><Label htmlFor={`no-${d.id}`}>Noter</Label><Textarea id={`no-${d.id}`} name="notes" defaultValue={d.notes ?? ""} className="min-h-[56px] text-xs" /></div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              formAction={async () => { "use server"; await sletSag(d.id); }}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-danger"
            >
              <Trash2 className="h-3 w-3" /> Slet
            </Button>
            <Button type="submit" size="sm" className="h-7 px-3 text-[11px]">Gem</Button>
          </div>
          <GemtAf af={d.updatedBy} tid={d.updatedAt} className="text-[11px]" />
        </form>
      </details>}
    </article>
  );
}

function AfsluttetKort({ sag: d, dage, nu, kanSkrive }: { sag: Sag; dage: number; nu: Date; kanSkrive: boolean }) {
  const vundet = d.stage === "vundet";
  const v = sagsVaerdi(d);
  const tilbage = dageTilOprydning(d.closedAt, dage, nu);
  return (
    <article className={cn("border rounded-lg p-3 flex flex-col gap-1.5", vundet ? "bg-success/[0.07] border-success/35" : "bg-card border-border opacity-80")}>
      <div className="flex items-start justify-between gap-2">
        <h4 className={cn("text-sm leading-snug min-w-0 break-words", vundet ? "font-bold text-success" : "font-medium")}>{d.title}</h4>
        <Badge variant={vundet ? "success" : "muted"} className="shrink-0 text-[10px] px-1.5">{vundet ? "Vundet" : "Tabt"}</Badge>
      </div>
      <div className={cn("text-xs tabular", vundet ? "font-semibold text-success/90" : "text-muted-foreground")}>
        {v != null ? `${kroner(v)}/år` : "ingen værdi"}{d.seatDelta ? ` · ${d.seatDelta} lic.` : ""}
      </div>
      {!vundet && d.lostReason && <p className="text-xs text-muted-foreground leading-snug">{d.lostReason}</p>}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        <span className="text-[11px] text-muted-foreground tabular" title={`Ryddes væk ${dage} dage efter afslutning`}>
          {d.closedAt ? datoKort(d.closedAt) : ""} · {tilbage === 0 ? "ryddes i dag" : `ryddes om ${tilbage} d.`}
        </span>
        {kanSkrive && (
        <IkonKnap action={flytStadie.bind(null, d.id, "forhandling")} titel="Genåbn i Forhandling" className="hover:text-primary">
          <RotateCcw className="h-3.5 w-3.5" />
        </IkonKnap>
        )}
      </div>
    </article>
  );
}
