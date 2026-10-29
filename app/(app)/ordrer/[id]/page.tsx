import { BekraeftSlet } from "@/components/ui/bekraeft-slet";
import { kanSkrive, rettigheder } from "@/lib/roller";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, ExternalLink, FileText, KeyRound, Paperclip, RefreshCw, Trash2, Undo2, XCircle } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { dato, kroner } from "@/lib/format";
import { dokNavn, dokNr, subNr } from "@/lib/dokumenter";
import { dagTekst, isoDag } from "@/lib/perioder";
import { ordreTotal } from "@/lib/ordre-pdf";
import { InternKort } from "@/components/ordrer/InternKort";
import { findInternStatus } from "@/lib/intern";
import { anvendOrdre, gemSalesforceLink, godkendTilbud, skiftTilbudsstatus, sletOrdre, tilbudTilOrdre } from "@/app/actions/ordrer";

const FEJL: Record<string, string> = {
  salesforce: "Salesforce-linket skal være en fuld adresse, der starter med https://",
  "for-stor": "Filen med accepten er for stor (højst 4 MB). Gem mailen som PDF, eller fjern vedhæftninger.",
  "ingen-kunde": "Tilbuddet har ingen kunde, så accepten kan ikke gemmes i en filboks.",
};

export const dynamic = "force-dynamic";

export default async function OrdreSide({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ besked?: string; fejl?: string }> }) {
  const { id } = await params;
  const { besked, fejl } = await searchParams;
  const [o, mig] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        company: { select: { id: true, name: true } },
        contract: { select: { id: true, subNumber: true, name: true } },
      },
    }),
    hentSession(),
  ]);
  if (!o) notFound();
  const skriv = kanSkrive(rettigheder(mig?.role).salg);
  const [kilde, afledte, accept] = await Promise.all([
    o.sourceOrderId ? db.order.findUnique({ where: { id: o.sourceOrderId }, select: { id: true, kind: true, number: true, acceptAttachmentId: true } }) : null,
    db.order.findMany({ where: { sourceOrderId: o.id }, select: { id: true, kind: true, number: true } }),
    // Accepten ligger på tilbuddet; en ordre lavet ud fra det viser den også
    db.attachment.findFirst({
      where: { id: o.acceptAttachmentId ?? "__ingen__" },
      select: { id: true, filename: true, createdAt: true },
    }),
  ]);
  const kildeAccept =
    !accept && kilde?.acceptAttachmentId
      ? await db.attachment.findUnique({ where: { id: kilde.acceptAttachmentId }, select: { id: true, filename: true, createdAt: true } })
      : null;
  const acceptFil = accept ?? kildeAccept;
  const erTilbud = o.kind === "tilbud";
  // Ældre tilbud, der blev til en ordre før der fandtes status, tæller som godkendt
  const status = erTilbud ? (o.status === "godkendt" || afledte.length > 0 ? "godkendt" : o.status === "afvist" ? "afvist" : "aaben") : null;
  const kanAnvendes = o.kind === "ordre" && !!o.companyId && !o.appliedAt && o.lines.some((l) => l.lineKind !== "fri");

  const sub = ordreTotal(o.lines);

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={o.company ? `/kunder/${o.company.id}` : "/ordrer"} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {o.company ? o.company.name : "Ordrebekræftelser"}
          </Link>
          <h1 className="mt-1.5 text-xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> {dokNavn(o.kind)} {dokNr(o)}
            {o.appliedAt && <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Lagt på kunden</Badge>}
            {status === "aaben" && <Badge variant="info">Afventer kunden</Badge>}
            {status === "godkendt" && <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Godkendt</Badge>}
            {status === "afvist" && <Badge variant="danger"><XCircle className="h-3 w-3 mr-1 inline" />Afvist</Badge>}
            {o.internStatus && <Badge variant={findInternStatus(o.internStatus)?.variant ?? "info"}>Intern: {findInternStatus(o.internStatus)?.label}</Badge>}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {dato(o.orderDate)} · {o.recipientName}{o.createdBy && ` · oprettet af ${o.createdBy}`}
            {o.validUntil && ` · gyldigt til ${dato(o.validUntil)}`}
            {kilde && <> · lavet ud fra <Link href={`/ordrer/${kilde.id}`} className="text-primary hover:underline">{dokNr(kilde)}</Link></>}
            {afledte.map((a) => <span key={a.id}> · ordre <Link href={`/ordrer/${a.id}`} className="text-primary hover:underline">{dokNr(a)}</Link></span>)}
          </p>
          {(o.contract || o.salesforceUrl || acceptFil) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {o.contract && o.company && (
                <Link href={`/kunder/${o.company.id}?fane=produkter&noegle=${o.contract.id}`}>
                  <Badge variant="muted"><KeyRound className="h-3 w-3 mr-1 inline" />{subNr(o.contract.subNumber)}{o.contract.name ? ` · ${o.contract.name}` : ""}</Badge>
                </Link>
              )}
              {o.salesforceUrl && (
                <a href={o.salesforceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Opportunity i Salesforce
                </a>
              )}
              {acceptFil && (
                <a href={`/api/filer/${acceptFil.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Paperclip className="h-3 w-3" /> Kundens accept
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/dokumenter/ordre/${o.id}`}><Button size="sm"><Download className="h-3.5 w-3.5" /> Hent PDF</Button></a>
          {o.attachmentId && (
            <a href={`/api/filer/${o.attachmentId}`}><Button size="sm" variant="secondary"><Paperclip className="h-3.5 w-3.5" /> I filboksen</Button></a>
          )}
        </div>
      </div>

      {besked === "oprettet" && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">
            {dokNavn(o.kind)} er oprettet{o.attachmentId ? " og gemt i kundens filboks" : ""}
            {o.appliedAt ? ", og kundens aftaler er opdateret" : ""}. Hent PDF'en med knappen ovenfor.
          </CardBody>
        </Card>
      )}
      {besked === "godkendt" && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">
            {erTilbud
              ? "Tilbuddet er markeret som godkendt."
              : `Tilbuddet er godkendt, og ordrebekræftelsen er oprettet${o.appliedAt ? ` — licenserne er lagt på ${o.contract ? subNr(o.contract.subNumber) : "kundens aftaler"}` : ""}.`}
            {acceptFil ? " Accepten ligger i kundens filboks under Accepter." : ""}
          </CardBody>
        </Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]"><CardBody className="text-sm">{FEJL[fejl]}</CardBody></Card>
      )}
      {(besked === "intern" || besked === "intern-gemt") && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">{besked === "intern" ? "Ordren er sendt til intern salg og ligger nu på listen Klar til intern salg." : "Oplysningerne til intern salg er gemt."}</CardBody>
        </Card>
      )}
      {besked === "anvendt" && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">Kundens aftaler er opdateret ud fra ordren.</CardBody></Card>
      )}

      {status === "aaben" && skriv && (
        <Card className="border-primary/40 bg-primary/[0.04]">
          <CardHeader
            title={<span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Kunden har accepteret?</span>}
            description="Vedhæft accepten — fx mailen gemt som PDF eller .msg. Den gemmes i kundens filboks og knyttes til tilbuddet."
          />
          <CardBody>
            <form action={godkendTilbud.bind(null, o.id)} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="acc">Accept (bilag)</Label>
                <Input id="acc" name="accept" type="file" accept=".pdf,.msg,.eml,.png,.jpg,.jpeg,.docx,application/pdf,image/*" className="h-auto py-1.5" />
              </div>
              <div><Label htmlFor="acd">Accepteret den</Label><Input id="acd" name="acceptedAt" type="date" defaultValue={isoDag(new Date())} /></div>
              <div><Label htmlFor="acn">Note (valgfri)</Label><Input id="acn" name="acceptNote" placeholder="fx Accept fra Jens Hansen pr. mail" /></div>
              <div className="sm:col-span-2">
                <Label htmlFor="acs" hint="kopiér adressen på Opportunity'en">Salesforce-link</Label>
                <Input id="acs" name="salesforceUrl" type="url" defaultValue={o.salesforceUrl ?? ""} placeholder="https://….lightning.force.com/lightning/r/Opportunity/006…/view" />
              </div>
              <label className="sm:col-span-2 flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="lavOrdre" value="1" defaultChecked className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                <span>
                  Lav ordrebekræftelsen med det samme
                  <span className="block text-xs text-muted-foreground">
                    {o.contract
                      ? `Licenserne lægges på ${subNr(o.contract.subNumber)} med nøglens udløb, og ordren gemmes i filboksen.`
                      : o.companyId
                        ? "Kundens aftaler opdateres, og ordren gemmes i filboksen."
                        : "Samme linjer og priser — nyt ORD-nummer."}
                  </span>
                </span>
              </label>
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-2">
                <Button size="sm" type="submit"><CheckCircle2 className="h-3.5 w-3.5" /> Markér som godkendt</Button>
              </div>
            </form>
            <form action={skiftTilbudsstatus.bind(null, o.id, "afvist")} className="mt-3 pt-3 border-t border-border flex justify-end">
              <Button size="sm" variant="ghost" type="submit"><XCircle className="h-3.5 w-3.5" /> Kunden har sagt nej</Button>
            </form>
          </CardBody>
        </Card>
      )}

      {status === "godkendt" && skriv && afledte.length === 0 && (
        <Card>
          <CardBody>
            <form action={tilbudTilOrdre.bind(null, o.id)} className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">Godkendt{o.acceptedAt ? ` ${dagTekst(o.acceptedAt)}` : ""}{o.acceptedBy ? ` af ${o.acceptedBy}` : ""} — ordrebekræftelsen mangler.</div>
                <div className="text-xs text-muted-foreground">Samme linjer og priser — nyt ORD-nummer og dagens dato.</div>
              </div>
              <div className="flex items-center gap-3">
                {o.companyId && (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="opdater" value="1" defaultChecked className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                    {o.contract ? `Læg på ${subNr(o.contract.subNumber)}` : "Opdatér kundens aftaler"}
                  </label>
                )}
                <Button size="sm" type="submit"><FileText className="h-3.5 w-3.5" /> Lav ordrebekræftelse</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {status === "afvist" && skriv && (
        <Card>
          <CardBody>
            <form action={skiftTilbudsstatus.bind(null, o.id, "aaben")} className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">Tilbuddet er markeret som afvist.</div>
              <Button size="sm" variant="secondary" type="submit"><Undo2 className="h-3.5 w-3.5" /> Genåbn tilbuddet</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <InternKort o={o} kanSende={skriv} kanStyre={!!mig?.ret.intern} />

      {kanAnvendes && skriv && (
        <Card>
          <CardBody>
            <form action={anvendOrdre.bind(null, o.id)} className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">Ordren er ikke lagt på kundens aftaler endnu.</div>
                <div className="text-xs text-muted-foreground">Fornyelser flytter udløbsdatoen, nye licenser registreres som tilkøb.</div>
              </div>
              <Button size="sm" variant="secondary" type="submit"><RefreshCw className="h-3.5 w-3.5" /> Opdatér kundens aftaler</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Modtager" />
        <CardBody className="text-sm flex flex-col gap-0.5">
          <span className="font-medium">{o.recipientName}</span>
          {o.recipientAttn && <span>Att. {o.recipientAttn}</span>}
          {o.recipientAddress && <span className="whitespace-pre-line text-muted-foreground">{o.recipientAddress}</span>}
          {o.recipientEmail && <span className="text-muted-foreground">{o.recipientEmail}</span>}
          {o.reference && <span className="text-muted-foreground mt-1">Reference: {o.reference}</span>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Linjer" />
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-5 py-2.5 font-medium">Beskrivelse</th>
                <th className="px-3 py-2.5 font-medium text-right">Antal</th>
                <th className="px-3 py-2.5 font-medium text-right">Enhedspris</th>
                <th className="px-3 py-2.5 font-medium">Periode</th>
                <th className="px-5 py-2.5 font-medium text-right">Beløb</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {o.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-2.5">
                    {l.description}
                    {l.details && <div className="text-xs text-muted-foreground whitespace-pre-line mt-0.5 line-clamp-3">{l.details}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{l.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular">{l.unitPrice == null ? "–" : `${kroner(l.unitPrice)}${l.months ? "/md." : ""}`}</td>
                  <td className="px-3 py-2.5 tabular text-xs">
                    {l.months ? (l.periodStart && l.periodEnd ? `${dagTekst(l.periodStart)} – ${dagTekst(l.periodEnd)} (${l.months} mdr.)` : `${l.months} mdr.`) : "Engang"}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular">{kroner(l.unitPrice == null ? 0 : l.quantity * l.unitPrice * (l.months ?? 1))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="font-semibold border-t border-border"><td colSpan={4} className="px-5 py-2 text-right">Samlet pris netto</td><td className="px-5 py-2 text-right tabular">{kroner(sub)}</td></tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>

      {o.note && <Card><CardHeader title="Bemærkninger" /><CardBody className="text-sm whitespace-pre-line">{o.note}</CardBody></Card>}

      {skriv && !(status === "aaben") && (
        <Card>
          <CardHeader title="Salesforce" description="Link til den Opportunity ordren hører til." />
          <CardBody>
            <form action={gemSalesforceLink.bind(null, o.id)} className="flex flex-col sm:flex-row gap-2">
              <Input name="salesforceUrl" type="url" defaultValue={o.salesforceUrl ?? ""} placeholder="https://….lightning.force.com/lightning/r/Opportunity/006…/view" aria-label="Salesforce-link" />
              <Button size="sm" variant="secondary" type="submit" className="shrink-0">Gem link</Button>
            </form>
          </CardBody>
        </Card>
      )}

      {mig?.erAdmin && (
        <form action={sletOrdre.bind(null, o.id)} className="flex justify-end">
          <BekraeftSlet hvad={`${o.kind === "tilbud" ? "tilbuddet" : "ordren"} ${dokNr(o)}`} className="inline-flex items-center gap-2 h-8 px-3 text-xs font-medium text-muted-foreground hover:text-danger"><Trash2 className="h-3.5 w-3.5" /> Slet ordre</BekraeftSlet>
        </form>
      )}
    </div>
  );
}
