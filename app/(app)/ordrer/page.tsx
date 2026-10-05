import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { ordreNr } from "@/lib/dokumenter";
import { ordreTotal } from "@/lib/ordre-pdf";

export const dynamic = "force-dynamic";

export default async function OrdrerSide({ searchParams }: { searchParams: Promise<{ kunde?: string; besked?: string }> }) {
  const { kunde, besked } = await searchParams;
  const ordrer = await db.order.findMany({
    where: kunde ? { companyId: kunde } : undefined,
    include: { lines: true, company: { select: { id: true, name: true } } },
    orderBy: { number: "desc" },
    take: 300,
  });

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      {besked === "slettet" && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">Ordren er slettet. PDF'en i kundens filboks er bevaret.</CardBody></Card>
      )}
      <Card>
        <CardHeader
          title="Ordrebekræftelser"
          description={`${tal(ordrer.length)} ordrer${kunde && ordrer[0]?.company ? ` for ${ordrer[0].company.name}` : ""}. PDF'en genskabes altid ud fra den gemte ordre.`}
          action={<Link href={`/ordrer/ny${kunde ? `?kunde=${kunde}` : ""}`}><Button size="sm"><Plus className="h-3.5 w-3.5" /> Ny ordrebekræftelse</Button></Link>}
        />
        <CardBody className="p-0">
          {ordrer.length === 0 ? (
            <div className="px-5"><EmptyState title="Ingen ordrebekræftelser endnu" icon={FileText} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Ordrenr.</th>
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
                      <td className="px-5 py-2.5 font-medium tabular"><Link href={`/ordrer/${o.id}`} className="hover:text-primary">{ordreNr(o.number)}</Link></td>
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
