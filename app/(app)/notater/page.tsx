import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { tal, tidspunkt } from "@/lib/format";
import { navneOpslag } from "@/lib/brugere";
import { NOTAT_KOLONNER, NOTAT_PRIORITET, NOTAT_SPOR } from "@/lib/labels";
import { Tavle, type Kort } from "@/components/notater/Tavle";
import { gemNotat, opretNotat, ryddFaerdige } from "@/app/actions/notater";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotatSide({
  searchParams,
}: {
  searchParams: Promise<{ spor?: string; kunde?: string; rediger?: string }>;
}) {
  const { spor, kunde, rediger } = await searchParams;

  const hvor: any = {};
  if (spor === "salg" || spor === "teknik") hvor.track = spor;
  if (kunde) hvor.companyId = kunde;

  const [notater, alle, kunder] = await Promise.all([
    db.customerNote.findMany({
      where: hvor,
      include: { company: { select: { id: true, name: true } } },
      orderBy: { position: "asc" },
    }),
    db.customerNote.findMany({ select: { lane: true, track: true, completedAt: true, dueAt: true } }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const under = rediger ? notater.find((n) => n.id === rediger) : null;
  const nu = new Date();
  const aabne = alle.filter((n) => n.completedAt == null);
  const forfaldne = aabne.filter((n) => n.dueAt != null && n.dueAt < nu).length;

  const navne = await navneOpslag();
  const gemtTekst = (af: string | null, tid: Date) => {
    const navn = af ? navne.get(af) ?? af : null;
    return navn ? `Sidst gemt af ${navn} · ${tidspunkt(tid)}` : `Sidst gemt ${tidspunkt(tid)}`;
  };

  const kort: Kort[] = notater.map((n) => ({
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
    company: n.company,
    gemt: gemtTekst(n.updatedBy, n.updatedAt),
  }));

  const filterHref = (nytSpor: string) =>
    `/notater?spor=${nytSpor}${kunde ? `&kunde=${kunde}` : ""}`;

  return (
    <div className="max-w-[1600px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Åbne notater" value={tal(aabne.length)} sub={`${tal(alle.length)} i alt`} />
        <StatCard label="Salg" value={tal(aabne.filter((n) => n.track === "salg").length)} sub="åbne på salgssporet" />
        <StatCard label="Teknik" value={tal(aabne.filter((n) => n.track === "teknik").length)} sub="åbne på teknik-sporet" />
        <StatCard label="Forfaldne" value={tal(forfaldne)} sub="dato overskredet" highlight={forfaldne > 0} />
      </div>

      <Card>
        <CardHeader
          title={under ? "Rediger notat" : "Nyt notat"}
          description={under ? undefined : "Kunde og dato er valgfrit. Alt andet kan rettes bagefter."}
          action={
            under ? (
              <Link href={`/notater${spor ? `?spor=${spor}` : ""}`} className="text-xs font-medium text-primary hover:underline">
                Annullér
              </Link>
            ) : undefined
          }
        />
        <CardBody>
          <form
            action={under ? gemNotat.bind(null, under.id) : opretNotat}
            className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
          >
            <div className="sm:col-span-2 lg:col-span-2">
              <Label htmlFor="title">Hvad skal der ske?</Label>
              <Input id="title" name="title" required defaultValue={under?.title ?? ""} placeholder="fx Ring om udvidelse til Medium" />
            </div>
            <div>
              <Label htmlFor="companyId">Kunde</Label>
              <Select id="companyId" name="companyId" defaultValue={under?.companyId ?? ""}>
                <option value="">Ingen</option>
                {kunder.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="track">Spor</Label>
              <Select id="track" name="track" defaultValue={under?.track ?? "salg"}>
                {NOTAT_SPOR.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Prioritet</Label>
              <Select id="priority" name="priority" defaultValue={under?.priority ?? "normal"}>
                {NOTAT_PRIORITET.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="lane">Kolonne</Label>
              <Select id="lane" name="lane" defaultValue={under?.lane ?? "nu"}>
                {NOTAT_KOLONNER.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Label htmlFor="details">Detaljer</Label>
              <Textarea id="details" name="details" defaultValue={under?.details ?? ""} className="min-h-[54px]" placeholder="valgfrit" />
            </div>
            <div>
              <Label htmlFor="dueAt">Dato</Label>
              <Input id="dueAt" name="dueAt" type="date" defaultValue={under?.dueAt ? under.dueAt.toISOString().slice(0, 10) : ""} />
            </div>
            <div className="sm:col-span-2 lg:col-span-6 flex justify-end">
              <Button type="submit">
                {under ? "Gem notat" : <><Plus className="h-3.5 w-3.5" /> Tilføj notat</>}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {[{ v: "alle", l: "Salg og teknik" }, ...NOTAT_SPOR.map((s) => ({ v: s.key, l: s.label }))].map((f) => (
          <Link
            key={f.v}
            href={filterHref(f.v)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              (spor ?? "alle") === f.v
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.l}
          </Link>
        ))}
        {kunde && (
          <Link href={`/notater${spor ? `?spor=${spor}` : ""}`} className="text-xs text-primary hover:underline ml-1">
            Ryd kundefilter
          </Link>
        )}
        <form action={ryddFaerdige} className="ml-auto">
          <Button size="sm" variant="ghost" type="submit" className="text-xs text-muted-foreground">
            Ryd Færdig-kolonnen
          </Button>
        </form>
      </div>

      {kort.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center flex flex-col items-center gap-2">
            <ListChecks className="h-7 w-7 text-muted-foreground/50" />
            <p className="text-sm font-medium">Ingen notater endnu</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Skriv det første ovenfor. Kortene kan trækkes mellem kolonnerne, og et flueben sender dem til Færdig.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Tavle kort={kort} redigerHref={(id) => `/notater?rediger=${id}${spor ? `&spor=${spor}` : ""}`} />
      )}

      <p className="text-xs text-muted-foreground">
        Træk kortene mellem kolonnerne, eller brug menuen nederst på kortet — den virker også på touch og med tastatur.
      </p>
    </div>
  );
}
