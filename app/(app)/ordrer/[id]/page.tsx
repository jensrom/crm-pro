import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { dato, kroner } from "@/lib/format";
import { ordreNr } from "@/lib/dokumenter";
import { ordreTotal } from "@/lib/ordre-pdf";
import { sletOrdre } from "@/app/actions/ordrer";

export const dynamic = "force-dynamic";

export default async function OrdreSide({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ besked?: string }> }) {
  const { id } = await params;
  const { besked } = await searchParams;
  const [o, mig] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: { lines: { orderBy: { sortOrder: "asc" } }, company: { select: { id: true, name: true } } },
    }),
    hentSession(),
  ]);
  if (!o) notFound();

  const sub = ordreTotal(o.lines);
  const moms = (sub * o.vatRate) / 100;

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={o.company ? `/kunder/${o.company.id}` : "/ordrer"} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {o.company ? o.company.name : "Ordrebekræftelser"}
          </Link>
          <h1 className="mt-1.5 text-xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> {ordreNr(o.number)}</h1>
          <p className="text-xs text-muted-foreground mt-1">{dato(o.orderDate)} · {o.recipientName}{o.createdBy && ` · oprettet af ${o.createdBy}`}</p>
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
            Ordrebekræftelsen er oprettet{o.attachmentId ? " og gemt i kundens filboks" : ""}. Hent PDF'en med knappen ovenfor.
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
                <th className="px-3 py-2.5 font-medium text-right">Periode</th>
                <th className="px-5 py-2.5 font-medium text-right">Beløb</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {o.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-2.5">{l.description}</td>
                  <td className="px-3 py-2.5 text-right tabular">{l.quantity}</td>
                  <td className="px-3 py-2.5 text-right tabular">{l.unitPrice == null ? "–" : `${kroner(l.unitPrice)}${l.months ? "/md." : ""}`}</td>
                  <td className="px-3 py-2.5 text-right tabular">{l.months ? `${l.months} mdr.` : "Engang"}</td>
                  <td className="px-5 py-2.5 text-right tabular">{kroner(l.unitPrice == null ? 0 : l.quantity * l.unitPrice * (l.months ?? 1))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-sm">
              <tr className="border-t border-border"><td colSpan={4} className="px-5 py-1.5 text-right text-muted-foreground">Subtotal ekskl. moms</td><td className="px-5 py-1.5 text-right tabular">{kroner(sub)}</td></tr>
              <tr><td colSpan={4} className="px-5 py-1.5 text-right text-muted-foreground">Moms {o.vatRate} %</td><td className="px-5 py-1.5 text-right tabular">{kroner(moms)}</td></tr>
              <tr className="font-semibold"><td colSpan={4} className="px-5 py-2 text-right">Total inkl. moms</td><td className="px-5 py-2 text-right tabular">{kroner(sub + moms)}</td></tr>
            </tfoot>
          </table>
        </CardBody>
      </Card>

      {o.note && <Card><CardHeader title="Bemærkninger" /><CardBody className="text-sm whitespace-pre-line">{o.note}</CardBody></Card>}

      {mig?.erAdmin && (
        <form action={sletOrdre.bind(null, o.id)} className="flex justify-end">
          <Button size="sm" variant="ghost" type="submit" className="text-muted-foreground hover:text-danger"><Trash2 className="h-3.5 w-3.5" /> Slet ordre</Button>
        </form>
      )}
    </div>
  );
}
