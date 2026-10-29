import { Check, FileBadge, Send, Undo2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BekraeftSlet } from "@/components/ui/bekraeft-slet";
import { cn } from "@/lib/utils";
import { dato } from "@/lib/format";
import { INTERN_STATUS, findInternStatus, kanLaveLicensbevis } from "@/lib/intern";
import { fjernFraIntern, gemInternData, sendTilIntern, skiftInternStatus } from "@/app/actions/intern";

type Linje = {
  id: string;
  description: string;
  productId: string | null;
  licenseModel: string;
  quantity: number;
  leverandoerRef: string | null;
  placering: string | null;
  partNr: string | null;
  version: string | null;
};

type Ordre = {
  id: string;
  kind: string;
  companyId: string | null;
  internStatus: string | null;
  internSentAt: Date | null;
  internSentBy: string | null;
  internAnsvarlig: string | null;
  internBestiltAt: Date | null;
  internAfventerAt: Date | null;
  internKlarAt: Date | null;
  internAfsluttetAt: Date | null;
  leverandoerOrdrenr: string | null;
  internNote: string | null;
  lines: Linje[];
};

/**
 * Intern salg på ordren: send videre, følg trinnene, udfyld licensdata og
 * lav licensbevis pr. produkt, når varen er klar til kunden.
 */
export function InternKort({ o, kanSende, kanStyre }: { o: Ordre; kanSende: boolean; kanStyre: boolean }) {
  if (o.kind !== "ordre") return null;

  if (!o.internStatus) {
    if (!kanSende) return null;
    return (
      <Card>
        <div id="intern" className="scroll-mt-24" />
        <CardBody>
          <form action={sendTilIntern.bind(null, o.id)} className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">Klar til bestilling?</div>
              <div className="text-xs text-muted-foreground">Send ordren til intern salg, som bestiller hos leverandøren og følger den til levering.</div>
            </div>
            <Button size="sm" type="submit"><Send className="h-3.5 w-3.5" /> Send til intern salg</Button>
          </form>
        </CardBody>
      </Card>
    );
  }

  const nu = INTERN_STATUS.findIndex((s) => s.key === o.internStatus);
  const tid = (felt: string) => (o as unknown as Record<string, Date | null>)[felt];
  const licensLinjer = o.lines.filter((l) => l.productId && l.licenseModel !== "fee");

  return (
    <Card>
      <div id="intern" className="scroll-mt-24" />
      <CardHeader
        title="Intern salg"
        description={`Sendt ${o.internSentAt ? dato(o.internSentAt) : ""}${o.internSentBy ? ` af ${o.internSentBy}` : ""}${o.internAnsvarlig ? ` · ansvarlig ${o.internAnsvarlig}` : ""}`}
        action={
          kanStyre ? (
            <form action={fjernFraIntern.bind(null, o.id)}>
              <BekraeftSlet hvad="ordren fra intern salg" detalje="Ordren bliver stående; kun forløbet hos intern salg nulstilles." className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-danger">
                <Undo2 className="h-3.5 w-3.5" /> Tag ud
              </BekraeftSlet>
            </form>
          ) : undefined
        }
      />
      <CardBody className="flex flex-col gap-5">
        {/* Trin */}
        <ol className="grid grid-cols-5 gap-1.5">
          {INTERN_STATUS.map((s, i) => {
            const faerdig = i < nu;
            const aktiv = i === nu;
            const t = tid(s.tidsfelt);
            const indhold = (
              <>
                <span className={cn("h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold shrink-0", faerdig ? "bg-success text-white" : aktiv ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {faerdig ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="min-w-0 text-left">
                  <span className={cn("block text-[11px] leading-tight", aktiv ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
                  {t && <span className="block text-[10px] text-muted-foreground tabular">{dato(t)}</span>}
                </span>
              </>
            );
            return (
              <li key={s.key}>
                {kanStyre && !aktiv ? (
                  <form action={skiftInternStatus.bind(null, o.id, s.key)}>
                    <button type="submit" title={`Sæt til ${s.label}`} className="w-full flex items-start gap-1.5 rounded-md border border-border p-1.5 hover:bg-secondary/60">{indhold}</button>
                  </form>
                ) : (
                  <div className={cn("flex items-start gap-1.5 rounded-md border p-1.5", aktiv ? "border-primary bg-primary/[0.06]" : "border-border")}>{indhold}</div>
                )}
              </li>
            );
          })}
        </ol>

        {/* Ordre- og licensdata */}
        <form key={`${o.id}-${o.internStatus}`} action={gemInternData.bind(null, o.id)} className="flex flex-col gap-4">
          <fieldset disabled={!kanStyre} className="contents">
            <div className="grid sm:grid-cols-3 gap-3">
              <div><Label htmlFor="lo">Leverandørens ordrenr.</Label><Input id="lo" name="leverandoerOrdrenr" defaultValue={o.leverandoerOrdrenr ?? ""} placeholder="fx D33912" /></div>
              <div><Label htmlFor="ia">Ansvarlig (initialer)</Label><Input id="ia" name="internAnsvarlig" defaultValue={o.internAnsvarlig ?? ""} maxLength={6} /></div>
              <div className="sm:col-span-3"><Label htmlFor="in">Intern note</Label><Textarea id="in" name="internNote" defaultValue={o.internNote ?? ""} className="min-h-[54px]" placeholder="fx leveringstid 3 uger" /></div>
            </div>
            {licensLinjer.length > 0 && (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-y border-border">
                      <th className="px-5 py-2 font-medium">Licens</th>
                      <th className="px-2 py-2 font-medium">Leverandør-ref.</th>
                      <th className="px-2 py-2 font-medium">Placering / info</th>
                      <th className="px-2 py-2 font-medium">Part #</th>
                      <th className="px-2 py-2 font-medium">Version</th>
                      <th className="px-5 py-2 font-medium text-right">Licensbevis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {licensLinjer.map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-2 min-w-[180px]">{l.quantity} × {l.description}</td>
                        <td className="px-2 py-2"><Input name={`ref_${l.id}`} defaultValue={l.leverandoerRef ?? ""} placeholder="fx 4571" className="h-8 text-xs w-28" /></td>
                        <td className="px-2 py-2"><Input name={`placering_${l.id}`} defaultValue={l.placering ?? ""} placeholder="fx Instance Holstebro" className="h-8 text-xs min-w-[150px]" /></td>
                        <td className="px-2 py-2"><Input name={`part_${l.id}`} defaultValue={l.partNr ?? ""} placeholder="02-510-110-101" className="h-8 text-xs w-36" /></td>
                        <td className="px-2 py-2"><Input name={`version_${l.id}`} defaultValue={l.version ?? ""} placeholder="1.0" className="h-8 text-xs w-16" /></td>
                        <td className="px-5 py-2 text-right whitespace-nowrap">
                          {kanLaveLicensbevis(o.internStatus) ? (
                            <a href={`/api/dokumenter/ordre/${o.id}/licensbevis?linje=${l.id}&gem=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              <FileBadge className="h-3.5 w-3.5" /> Lav bevis
                            </a>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">fra &quot;Klar til kunde&quot;</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {kanStyre && (
              <div className="flex justify-end"><Button size="sm" type="submit">Gem</Button></div>
            )}
          </fieldset>
        </form>
        {!kanStyre && <p className="text-xs text-muted-foreground">Status: {findInternStatus(o.internStatus)?.label}. Kun intern salg kan ændre forløbet.</p>}
      </CardBody>
    </Card>
  );
}
