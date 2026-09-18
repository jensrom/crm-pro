import Link from "next/link";
import { LifeBuoy, Scissors, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HotWidget } from "@/components/dashboard/HotWidget";
import { db } from "@/lib/db";
import { datoKort, tal } from "@/lib/format";
import { AABNE_SAGSSTATUS, findKundestatus, findSagsprioritet, findSagsstatus } from "@/lib/labels";
import { alderIDage, alderTekst, kortnummer, kortstatus, sagsnummer, varighed } from "@/lib/teknik";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeknikDashboard() {
  const nu = new Date();

  const [aabne, alle, kort, tidSum, hotte] = await Promise.all([
    db.ticket.findMany({
      where: { status: { in: AABNE_SAGSSTATUS as unknown as string[] } },
      include: {
        company: { select: { id: true, name: true, customerStatus: true } },
        timeLogs: { select: { durationMin: true } },
      },
    }),
    db.ticket.count(),
    db.hourBundle.findMany({ where: { isActive: true }, include: { company: { select: { id: true, name: true } } } }),
    db.timeLog.aggregate({ _sum: { durationMin: true } }),
    db.company.findMany({
      where: { isActive: true, isHot: true },
      orderBy: { hotSince: "desc" },
      select: { id: true, name: true, hotSince: true, hotSetBy: true },
    } as any),
  ]);

  const rang = (p: string) => findSagsprioritet(p).rang;
  const vigtigste = [...aabne].sort((a, b) => rang(b.priority) - rang(a.priority) || a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 8);
  const aeldste = [...aabne].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 8);
  const kritiske = aabne.filter((s) => s.priority === "kritisk").length;
  const forfaldne = aabne.filter((s) => s.dueAt != null && s.dueAt < nu);

  const kortStatus = kort.map((k) => ({ k, s: kortstatus(k, nu) }));
  const restMin = kortStatus.filter(({ s }) => !s.udloebet).reduce((sum, { s }) => sum + Math.max(0, s.restMin), 0);
  const kritiskeKort = kortStatus.filter(({ s }) => !s.udloebet && (s.opbrugt || s.naestenOpbrugt));

  const SagsListe = ({ sager, tomTekst }: { sager: typeof aabne; tomTekst: string }) =>
    sager.length === 0 ? (
      <EmptyState title={tomTekst} icon={LifeBuoy} />
    ) : (
      <ul className="divide-y divide-border">
        {sager.map((s) => {
          const p = findSagsprioritet(s.priority);
          const st = findSagsstatus(s.status);
          const dage = alderIDage(s.createdAt, nu);
          const ks = findKundestatus(s.company.customerStatus);
          return (
            <li key={s.id} className="px-5 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link href={`/teknik/sager/${s.id}`} className="text-sm font-medium hover:text-primary block truncate">
                  {s.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular">{sagsnummer(s.number)}</span>
                  <Link href={`/kunder/${s.company.id}`} className="hover:text-primary truncate">{s.company.name}</Link>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: ks.bg }} aria-hidden />
                    {ks.label}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant={p.variant}>{p.label}</Badge>
                <span className={cn("text-xs tabular", dage > 30 ? "text-danger font-semibold" : "text-muted-foreground")}>
                  {alderTekst(dage)}
                </span>
                <span className="text-xs text-muted-foreground">{st.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Åbne sager" value={tal(aabne.length)} sub={`${tal(alle)} sager i alt`} />
        <StatCard label="Kritiske" value={tal(kritiske)} sub="højeste prioritet, stadig åbne" highlight={kritiske > 0} />
        <StatCard label="Timer tilbage" value={varighed(restMin)} sub={`på ${tal(kortStatus.filter(({ s }) => !s.udloebet).length)} aktive klippekort`} />
        <StatCard label="Tid registreret" value={varighed(tidSum._sum.durationMin ?? 0)} sub="i alt" />
      </div>

      <HotWidget rows={hotte as any} />

      {forfaldne.length > 0 && (
        <Card className="border-danger/40 bg-danger/[0.05]">
          <CardBody className="flex items-start gap-3">
            <TriangleAlert className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{forfaldne.length} sager har overskredet den aftalte frist</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {forfaldne.slice(0, 5).map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ", "}
                    <Link href={`/teknik/sager/${s.id}`} className="text-primary hover:underline">{s.title}</Link>
                    {" "}({datoKort(s.dueAt)})
                  </span>
                ))}
                {forfaldne.length > 5 && ` og ${forfaldne.length - 5} mere`}.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {kritiskeKort.length > 0 && (
        <Card className="border-warning/40 bg-warning/[0.05]">
          <CardBody className="flex items-start gap-3">
            <Scissors className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{kritiskeKort.length} klippekort er brugt op eller tæt på</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {kritiskeKort.slice(0, 6).map(({ k, s }, i) => (
                  <span key={k.id}>
                    {i > 0 && ", "}
                    <Link href={`/kunder/${k.company.id}`} className="text-primary hover:underline">{k.company.name}</Link>
                    {" "}({kortnummer(k.number)}, {varighed(Math.max(0, s.restMin))} tilbage)
                  </span>
                ))}
                . Værd at tage fat i inden de løber tør.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <Card>
          <CardHeader
            title="Vigtigste sager"
            description="Højeste prioritet først, ældste inden for hvert niveau."
            action={<Link href="/teknik/sager" className="text-xs font-medium text-primary hover:underline">Alle sager</Link>}
          />
          <CardBody className="p-0"><SagsListe sager={vigtigste} tomTekst="Ingen åbne sager" /></CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Ældste sager"
            description="Dem der har ligget længst. Det er som regel her utilfredsheden bygger sig op."
            action={<Link href="/teknik/sager?status=aabne" className="text-xs font-medium text-primary hover:underline">Alle sager</Link>}
          />
          <CardBody className="p-0"><SagsListe sager={aeldste} tomTekst="Ingen åbne sager" /></CardBody>
        </Card>
      </div>
    </div>
  );
}
