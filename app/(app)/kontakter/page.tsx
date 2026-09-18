import Link from "next/link";
import { Mail, Phone, Users } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { BESLUTNINGSROLLER, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function KontakterSide() {
  const kontakter = await db.contact.findMany({
    where: { isActive: true },
    include: { company: { select: { id: true, name: true, country: true } } },
    orderBy: [{ firstName: "asc" }],
  });

  const sorteret = [...kontakter].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "da-DK")
  );

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Kontaktpersoner på tværs af kunderne. De primære er hentet fra portalens felt for primær kontakt — resten
        tilføjer du selv på den enkelte kunde.
      </p>

      <Card>
        <CardHeader title={`${sorteret.length} kontakter`} />
        <CardBody className="p-0">
          {sorteret.length === 0 ? (
            <EmptyState title="Ingen kontakter endnu" icon={Users} description="Tilføj dem fra den enkelte kundes side." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Navn</th>
                    <th className="px-3 py-2.5 font-medium">Kunde</th>
                    <th className="px-3 py-2.5 font-medium">Stilling</th>
                    <th className="px-3 py-2.5 font-medium">Rolle</th>
                    <th className="px-5 py-2.5 font-medium">Kontakt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorteret.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary/60">
                      <td className="px-5 py-2.5 font-medium whitespace-nowrap">
                        {c.firstName} {c.lastName}
                        {c.isPrimary && <Badge variant="info" className="ml-2">Primær</Badge>}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.company ? (
                          <Link href={`/kunder/${c.company.id}`} className="hover:text-primary">
                            {c.company.name}
                          </Link>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.title ?? "–"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{label(BESLUTNINGSROLLER, c.decisionRole ?? "")}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
                              <Mail className="h-3 w-3 shrink-0" />
                              {c.email}
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              {c.phone}
                            </a>
                          )}
                          {!c.email && !c.phone && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                      </td>
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
