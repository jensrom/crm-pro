import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { dokNr } from "@/lib/dokumenter";
import { Badge } from "@/components/ui/badge";
import { ordreTotal } from "@/lib/ordre-pdf";

export const dynamic = "force-dynamic";

export default async function OrdrerSide({ searchParams }: { searchParams: Promise<{ kunde?: string; besked?: string; type?: string }> }) {
  const { kunde, besked, type } = await searchParams;
  const ordrer = await db.order.findMany({
    where: { ...(kunde ? { companyId: kunde } : {}), ...(type === "tilbud" || type === "ordre" ? { kind: type } : {}) },
    include: { lines: true, company: { select: { id: true, name: true } } },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      {besked === "slettet" && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">Ordren er slettet. PDF'en i kundens filboks er bevaret.</CardBody></Card>
      )}
      <Card>
        <CardHeader
          title="Tilbud og ordrebekræftelser"
          description={`${tal(ordrer.length)} dokumenter${kunde && ordrer[0]?.company ? ` for ${ordrer[0].company.name}` : ""}. PDF'en genskabes altid ud fra det gemte dokument.`}
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {[["", "Alle"], ["tilbud", "Tilbud"], ["ordre", "Ordrer"]].map(([k, l]) => (
                  <Link key={k} href={`/ordrer?${new URLSearchParams({ ...(kunde ? { kunde } : {}), ...(k ? { type: k } : {}) })}`} className={(type ?? "") === k ? "px-2.5 py-1 bg-primary text-primary-foreground" : "px-2.5 py-1 hover:bg-secondary"}>{l}</Link>
                ))}
              </div>
              <Link href={`/ordrer/ny?type=tilbud${kunde ? `&kunde=${kunde}` : ""}`}><Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Tilbud</Button></Link>
              <Link href={`/ordrer/ny?type=ordre${kunde ? `&kunde=${kunde}` : ""}`}><Button size="sm"><Plus className="h-3.5 w-3.5" /> Ordrebekræftelse</Button></Link>
            </div>
          }
        />
        <CardBody className="p-0">
          {ordrer.length === 0 ? (
            <div className="px-5"><EmptyState title="Ingen tilbud eller ordrer endnu" icon={FileText} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Nummer</th>
                    <th className="px-3 py-2.5 font-medium">Dato</th>
                    <th className="px-3 py-2.5 font-medium">Modtager</th>
                    <th className="px-3 py-2.5 font-medium text-right">Linjer</th>
                    <th className="px-3 py-2.5 font-medium text-right">Beløb ekskl. moms</th>
                    <th className="px-5 py-2.5 font-medium">Oprettet af</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ordrer.map((o) => (
                    <tr key={o.id} className="hover:bg-secondary/60">
                      <td className="px-5 py-2.5 font-medium tabular">
                        <Link href={`/ordrer/${o.id}`} className="hover:text-primary">{dokNr(o)}</Link>
                        {o.kind === "tilbud" && <Badge variant="warning" className="ml-2">Tilbud</Badge>}
                        {o.lines.some((l) => l.lineKind === "fornyelse") && <Badge variant="info" className="ml-1">Fornyelse</Badge>}
                      </td>
                      <td className="px-3 py-2.5 tabular text-muted-foreground">{datoKort(o.orderDate)}</td>
                      <td className="px-3 py-2.5">
                        {o.company ? <Link href={`/kunder/${o.company.id}`} className="hover:text-primary">{o.recipientName}</Link> : o.recipientName}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular">{o.lines.length}</td>
                      <td className="px-3 py-2.5 text-right tabular">{kroner(ordreTotal(o.lines))}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{o.createdBy ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
