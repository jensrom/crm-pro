import Link from "next/link";
import { CalendarClock, Check, Undo2 } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { dato, tal } from "@/lib/format";
import { AKTIVITETSTYPER, label } from "@/lib/labels";
import { opretAktivitet, skiftAktivitet, sletAktivitet } from "@/app/actions/salg";

export const dynamic = "force-dynamic";

export default async function AktiviteterSide() {
  const [aktiviteter, kunder] = await Promise.all([
    db.activity.findMany({
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const nu = new Date();
  const aabne = aktiviteter.filter((a) => !a.completedAt);
  const forfaldne = aabne.filter((a) => a.dueDate && a.dueDate < nu);
  const faerdige = aktiviteter.filter((a) => a.completedAt);

  return (
    <div className="max-w-[1100px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Åbne" value={tal(aabne.length)} sub="ikke afsluttet" />
        <StatCard label="Forfaldne" value={tal(forfaldne.length)} sub="forfald overskredet" highlight={forfaldne.length > 0} />
        <StatCard label="Afsluttede" value={tal(faerdige.length)} />
      </div>

      <Card>
        <CardHeader title="Ny aktivitet" />
        <CardBody>
          <form action={opretAktivitet} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <Label htmlFor="t">Type</Label>
              <Select id="t" name="type" defaultValue="opgave">
                {AKTIVITETSTYPER.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </Select>
            </div>
            <div className="lg:col-span-2"><Label htmlFor="s">Emne</Label><Input id="s" name="subject" required placeholder="fx Ring om ledige pladser" /></div>
            <div>
              <Label htmlFor="c">Kunde</Label>
              <Select id="c" name="companyId" defaultValue="">
                <option value="">Ingen</option>
                {kunder.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>
            </div>
            <div><Label htmlFor="d">Forfald</Label><Input id="d" name="dueDate" type="date" /></div>
            <div className="sm:col-span-2 lg:col-span-4"><Textarea name="description" placeholder="Beskrivelse (valgfri)" className="min-h-[38px]" /></div>
            <div className="flex justify-end"><Button type="submit">Tilføj</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Åbne aktiviteter (${aabne.length})`} />
        <CardBody className="p-0">
          {aabne.length === 0 ? (
            <EmptyState title="Intet udestående" icon={CalendarClock} description="Alt er lukket af." />
          ) : (
            <ul className="divide-y divide-border">
              {aabne.map((a) => {
                const forfalden = a.dueDate && a.dueDate < nu;
                return (
                  <li key={a.id} className="px-5 py-3 flex items-start gap-4">
                    <form action={async () => { "use server"; await skiftAktivitet(a.id, true); }}>
                      <button
                        type="submit"
                        aria-label="Markér som færdig"
                        className="mt-0.5 h-5 w-5 rounded border border-border grid place-items-center text-transparent hover:text-primary hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{a.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge variant="muted">{label(AKTIVITETSTYPER, a.type)}</Badge>
                        {a.company && (
                          <Link href={`/kunder/${a.company.id}`} className="hover:text-primary">
                            {a.company.name}
                          </Link>
                        )}
                        {a.dueDate && (
                          <span className={forfalden ? "text-danger font-medium" : ""}>Forfald {dato(a.dueDate)}</span>
                        )}
                      </div>
                      {a.description && <p className="text-xs text-muted-foreground mt-1 max-w-prose">{a.description}</p>}
                    </div>
                    <form action={async () => { "use server"; await sletAktivitet(a.id); }}>
                      <Button type="submit" size="sm" variant="ghost" className="text-xs text-muted-foreground">Slet</Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {faerdige.length > 0 && (
        <Card>
          <CardHeader title={`Afsluttet (${faerdige.length})`} />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {faerdige.slice(0, 40).map((a) => (
                <li key={a.id} className="px-5 py-2.5 flex items-center gap-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="line-through text-muted-foreground">{a.subject}</span>
                    {a.company && <span className="text-xs text-muted-foreground"> · {a.company.name}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground tabular shrink-0">{dato(a.completedAt)}</span>
                  <form action={async () => { "use server"; await skiftAktivitet(a.id, false); }}>
                    <button type="submit" aria-label="Genåbn" className="text-muted-foreground hover:text-foreground p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Undo2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
