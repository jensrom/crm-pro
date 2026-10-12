import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Tavle, type Kort } from "@/components/notater/Tavle";
import { db } from "@/lib/db";
import { navneOpslag } from "@/lib/brugere";
import { tal, tidspunkt } from "@/lib/format";
import { NOTAT_KOLONNER, NOTAT_PRIORITET, NOTAT_SPOR } from "@/lib/labels";
import { gemNotat, opretNotat, ryddFaerdigeForKunde } from "@/app/actions/notater";
import { cn } from "@/lib/utils";

/**
 * Kundens egen notattavle (Nu / Næste / Venter / Færdig) — samme tavle som
 * den samlede, men kun med denne kundes kort. Spor-filteret og redigering
 * ligger i URL'en, så fanen bliver stående efter hvert gem.
 */
export async function NotatFane({
  kundeId,
  spor,
  rediger,
}: {
  kundeId: string;
  spor?: string;
  rediger?: string;
}) {
  const filterSpor = spor === "salg" || spor === "teknik" ? spor : null;
  const [notater, navne] = await Promise.all([
    db.customerNote.findMany({
      where: { companyId: kundeId, ...(filterSpor ? { track: filterSpor } : {}) },
      orderBy: { position: "asc" },
    }),
    navneOpslag(),
  ]);

  const basis = `/kunder/${kundeId}?fane=notater${filterSpor ? `&spor=${filterSpor}` : ""}`;
  const under = rediger ? notater.find((n) => n.id === rediger) ?? null : null;
  const nu = new Date();
  const aabne = notater.filter((n) => !n.completedAt);
  const forfaldne = aabne.filter((n) => n.dueAt && n.dueAt < nu).length;

  const kort: Kort[] = notater.map((n) => {
    const navn = n.updatedBy ? navne.get(n.updatedBy) ?? n.updatedBy : null;
    return {
      id: n.id,
      title: n.title,
      details: n.details,
      lane: n.lane,
      position: n.position,
      track: n.track,
      priority: n.priority,
      dueAt: n.dueAt,
      completedAt: n.completedAt,
      author: n.author,
      company: null, // vi står allerede på kunden
      gemt: navn ? `Sidst gemt af ${navn} · ${tidspunkt(n.updatedAt)}` : `Sidst gemt ${tidspunkt(n.updatedAt)}`,
    };
  });

  const gem = async (fd: FormData) => {
    "use server";
    if (under) await gemNotat(under.id, fd);
    else await opretNotat(fd);
    redirect(basis);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title={under ? "Rediger notat" : "Nyt notat"}
          description={under ? undefined : `${tal(aabne.length)} åbne${forfaldne ? ` · ${tal(forfaldne)} forfaldne` : ""}. Små opgaver på kunden — mærk dem Salg eller Teknik.`}
          action={under ? <Link href={basis} scroll={false} className="text-xs font-medium text-primary hover:underline">Annullér</Link> : undefined}
        />
        <CardBody>
          <form action={gem} key={under?.id ?? "ny"} className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <input type="hidden" name="companyId" value={kundeId} />
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="nf-t">Hvad skal der ske?</Label>
              <Input id="nf-t" name="title" required defaultValue={under?.title ?? ""} placeholder="fx Følg op på tilbud om ekstra licenser" />
            </div>
            <div>
              <Label htmlFor="nf-s">Spor</Label>
              <Select id="nf-s" name="track" defaultValue={under?.track ?? filterSpor ?? "salg"}>
                {NOTAT_SPOR.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="nf-p">Prioritet</Label>
              <Select id="nf-p" name="priority" defaultValue={under?.priority ?? "normal"}>
                {NOTAT_PRIORITET.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="nf-k">Kolonne</Label>
              <Select id="nf-k" name="lane" defaultValue={under?.lane ?? "nu"}>
                {NOTAT_KOLONNER.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label htmlFor="nf-d">Detaljer</Label>
              <Textarea id="nf-d" name="details" defaultValue={under?.details ?? ""} className="min-h-[40px]" placeholder="valgfrit" />
            </div>
            <div>
              <Label htmlFor="nf-dato">Dato</Label>
              <Input id="nf-dato" name="dueAt" type="date" defaultValue={under?.dueAt ? under.dueAt.toISOString().slice(0, 10) : ""} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">{under ? "Gem notat" : <><Plus className="h-3.5 w-3.5" /> Tilføj</>}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {[{ v: null, l: "Salg og teknik" }, ...NOTAT_SPOR.map((s) => ({ v: s.key, l: s.label }))].map((f) => (
          <Link
            key={f.l}
            href={`/kunder/${kundeId}?fane=notater${f.v ? `&spor=${f.v}` : ""}`}
            scroll={false}
            className={cn(
              "px-3 py-1.5 rounded-none text-xs font-medium border transition-colors",
              filterSpor === f.v ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.l}
          </Link>
        ))}
        {notater.some((n) => n.lane === "faerdig") && (
          <form action={ryddFaerdigeForKunde.bind(null, kundeId)} className="ml-auto">
            <Button size="sm" variant="ghost" type="submit" className="text-xs text-muted-foreground">Ryd Færdig-kolonnen</Button>
          </form>
        )}
      </div>

      {kort.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center flex flex-col items-center gap-2">
            <ListChecks className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm font-medium">Ingen notater{filterSpor ? ` på ${filterSpor}` : ""} endnu</p>
            <p className="text-xs text-muted-foreground max-w-sm">Skriv det første ovenfor. Kortene kan trækkes mellem kolonnerne.</p>
          </CardBody>
        </Card>
      ) : (
        <Tavle kort={kort} redigerBase={`${basis}&rediger=`} />
      )}
    </div>
  );
}
