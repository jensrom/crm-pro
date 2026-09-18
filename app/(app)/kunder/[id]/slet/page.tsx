import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { db } from "@/lib/db";
import { tal } from "@/lib/format";
import { sletKunde } from "@/app/actions/kunder";

export const dynamic = "force-dynamic";

export default async function SletKunde({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fejl?: string }>;
}) {
  const { id } = await params;
  const { fejl } = await searchParams;

  const kunde = await db.company.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          contacts: true,
          customerProducts: true,
          deals: true,
          tickets: true,
          hourBundles: true,
          logEntries: true,
          activities: true,
          timeLogs: true,
        },
      },
    },
  });
  if (!kunde) notFound();

  const c = kunde._count;
  const linjer: [string, number][] = [
    ["kontaktpersoner", c.contacts],
    ["licenslinjer", c.customerProducts],
    ["salgsmuligheder", c.deals],
    ["sager", c.tickets],
    ["klippekort", c.hourBundles],
    ["tidsposter", c.timeLogs],
    ["logbogsposter", c.logEntries],
    ["aktiviteter", c.activities],
  ];

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <Link href={`/kunder/${kunde.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Tilbage til {kunde.name}
      </Link>

      {fejl === "navn" && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            Navnet stemte ikke. Skriv kundens navn præcis som det står, for at bekræfte.
          </CardBody>
        </Card>
      )}

      <Card className="border-danger/50">
        <CardHeader
          title={<span className="text-danger">Slet {kunde.name}</span>}
          description="Kunden og alt der hænger på den fjernes permanent. Der er ingen fortrydelse."
        />
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-sm mb-2">Følgende slettes med:</p>
            <ul className="text-sm text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-1">
              {linjer.map(([navn, antal]) => (
                <li key={navn} className="flex justify-between gap-3 tabular">
                  <span>{navn}</span>
                  <span className={antal > 0 ? "font-medium text-foreground" : ""}>{tal(antal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <form action={sletKunde.bind(null, kunde.id)} className="flex flex-col gap-3 border-t border-border pt-4">
            <div>
              <Label htmlFor="bekraeft">Skriv kundens navn for at bekræfte</Label>
              <Input id="bekraeft" name="bekraeft" required placeholder={kunde.name} autoComplete="off" />
              <p className="text-xs text-muted-foreground mt-1.5">
                Præcis <b className="text-foreground">{kunde.name}</b> — det er den eneste spærring mellem dig og en permanent sletning.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Link href={`/kunder/${kunde.id}`}><Button variant="secondary" type="button">Fortryd</Button></Link>
              <Button variant="danger" type="submit">Slet kunden permanent</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
