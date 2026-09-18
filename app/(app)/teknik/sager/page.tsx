import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { GemValg } from "@/components/ui/gem-valg";
import { GemtAf } from "@/components/ui/gemt-af";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { datoKort, tal } from "@/lib/format";
import { AABNE_SAGSSTATUS, SAGSPRIORITET, SAGSSTATUS, findSagsprioritet, findSagsstatus } from "@/lib/labels";
import { alderIDage, alderTekst, sagsnummer, varighed } from "@/lib/teknik";
import { skiftSagsstatus } from "@/app/actions/teknik";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SagerSide({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; prioritet?: string; kunde?: string }>;
}) {
  const { status, prioritet, kunde } = await searchParams;

  const hvor: any = {};
  if (status === "aabne") hvor.status = { in: AABNE_SAGSSTATUS };
  else if (status && status !== "alle") hvor.status = status;
  else if (!status) hvor.status = { in: AABNE_SAGSSTATUS };
  if (prioritet && prioritet !== "alle") hvor.priority = prioritet;
  if (kunde) hvor.companyId = kunde;

  const [sager, alle, kunder] = await Promise.all([
    db.ticket.findMany({
      where: hvor,
      include: { company: { select: { id: true, name: true } }, timeLogs: { select: { durationMin: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    db.ticket.findMany({ select: { status: true, priority: true } }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const aabne = alle.filter((s) => AABNE_SAGSSTATUS.includes(s.status as any)).length;
  const kritiske = alle.filter((s) => s.priority === "kritisk" && AABNE_SAGSSTATUS.includes(s.status as any)).length;
  const nu = new Date();

  const rang = (p: string) => findSagsprioritet(p).rang;
  const sorteret = [...sager].sort((a, b) => rang(b.priority) - rang(a.priority) || a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div className="max-w-[1400px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Åbne sager" value={tal(aabne)} sub={`${tal(alle.length)} i alt`} />
        <StatCard label="Kritiske" value={tal(kritiske)} sub="åbne med højeste prioritet" highlight={kritiske > 0} />
        <StatCard label="Vist nu" value={tal(sager.length)} sub="efter filtrene herunder" />
        <StatCard
          label="Ældste åbne"
          value={sorteret.length ? alderTekst(alderIDage(sorteret.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt, nu)) : "–"}
          sub="siden oprettelse"
        />
      </div>

      <Card>
        <CardHeader
          title="Sager"
          description="Sorteret efter prioritet, og derefter efter alder — det ældste øverst inden for hvert niveau."
          action={
            <Link href="/teknik/sager/ny">
              <Button size="sm"><Plus className="h-3.5 w-3.5" /> Ny sag</Button>
            </Link>
          }
        />

        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-border">
          {[
            { v: "aabne", l: "Åbne" },
            ...SAGSSTATUS.map((s) => ({ v: s.key, l: s.label })),
            { v: "alle", l: "Alle" },
          ].map((f) => (
            <Link
              key={f.v}
              href={`/teknik/sager?status=${f.v}${prioritet ? `&prioritet=${prioritet}` : ""}`}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                (status ?? "aabne") === f.v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {f.l}
            </Link>
          ))}
          <span className="w-px h-6 bg-border mx-1" />
          {[{ v: "alle", l: "Al prioritet" }, ...SAGSPRIORITET.map((p) => ({ v: p.key, l: p.label }))].map((f) => (
            <Link
              key={f.v}
              href={`/teknik/sager?status=${status ?? "aabne"}&prioritet=${f.v}`}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                (prioritet ?? "alle") === f.v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {f.l}
            </Link>
          ))}
        </div>

        <CardBody className="p-0">
          {sorteret.length === 0 ? (
            <EmptyState title="Ingen sager matcher" icon={LifeBuoy} description="Prøv et andet filter, eller opret en ny sag." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Nr.</th>
                    <th className="px-3 py-2.5 font-medium">Sag</th>
                    <th className="px-3 py-2.5 font-medium">Kunde</th>
                    <th className="px-3 py-2.5 font-medium">Prioritet</th>
                    <th className="px-3 py-2.5 font-medium text-right">Alder</th>
                    <th className="px-3 py-2.5 font-medium text-right">Tid brugt</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorteret.map((s) => {
                    const p = findSagsprioritet(s.priority);
                    const dage = alderIDage(s.createdAt, nu);
                    const brugt = s.timeLogs.reduce((sum, t) => sum + t.durationMin, 0);
                    const forfalden = s.dueAt != null && s.dueAt < nu && AABNE_SAGSSTATUS.includes(s.status as any);
                    return (
                      <tr key={s.id} className="hover:bg-secondary/60">
                        <td className="px-5 py-2.5 tabular text-xs text-muted-foreground whitespace-nowrap">{sagsnummer(s.number)}</td>
                        <td className="px-3 py-2.5 min-w-[220px]">
                          <Link href={`/teknik/sager/${s.id}`} className="font-medium hover:text-primary">{s.title}</Link>
                          {forfalden && <Badge variant="danger" className="ml-2">Frist overskredet {datoKort(s.dueAt)}</Badge>}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link href={`/kunder/${s.company.id}`} className="text-muted-foreground hover:text-primary">{s.company.name}</Link>
                        </td>
                        <td className="px-3 py-2.5"><Badge variant={p.variant}>{p.label}</Badge></td>
                        <td className={cn("px-3 py-2.5 text-right tabular text-xs", dage > 30 && "text-danger font-semibold")}>{alderTekst(dage)}</td>
                        <td className="px-3 py-2.5 text-right tabular text-xs text-muted-foreground">{brugt > 0 ? varighed(brugt) : "–"}</td>
                        <td className="px-5 py-2">
                          <GemValg
                            action={async (fd: FormData) => {
                              "use server";
                              const valgt = fd.get("status");
                              if (typeof valgt === "string" && valgt && valgt !== s.status) await skiftSagsstatus(s.id, valgt);
                            }}
                            name="status"
                            value={s.status}
                            options={SAGSSTATUS}
                            ariaLabel={`Status for ${s.title}`}
                            selectClassName="h-8 text-xs w-44"
                          />
                          <GemtAf af={s.updatedBy} tid={s.updatedAt} className="mt-1 text-[11px]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
                Skift status i dropdownen og tryk Gem, eller åbn sagen for at rette resten.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
