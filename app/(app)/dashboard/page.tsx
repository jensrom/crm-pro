import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HotWidget } from "@/components/dashboard/HotWidget";
import { PakkeDiagram, UdnyttelseDiagram } from "@/components/dashboard/Diagrammer";
import { hentKunderMedNoegletal } from "@/lib/analysis";
import { db } from "@/lib/db";
import { kroner, millioner, procent, tal } from "@/lib/format";
import { PRIORITET } from "@/lib/labels";
import { ProduktMaerke, findFarve } from "@/lib/produktstil";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [{ kunder, indstillinger }, aabneSager, pakker, hotte] = await Promise.all([
    hentKunderMedNoegletal(),
    db.deal.findMany({
      where: { stage: { notIn: ["vundet", "tabt"] } },
      include: { company: { select: { id: true, name: true } }, product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.company.findMany({
      where: { isActive: true, isHot: true },
      orderBy: { hotSince: "desc" },
      select: { id: true, name: true, hotSince: true, hotSetBy: true },
    } as any),
  ]);

  const seats = kunder.reduce((s, k) => s + k.n.seats, 0);
  const aktive = kunder.reduce((s, k) => s + k.n.aktive, 0);
  const fulde = kunder.filter((k) => k.n.fuld).length;
  const aarsvaerdi = kunder.reduce((s, k) => s + k.n.aarsvaerdi, 0);
  const udenPris = kunder.filter((k) => k.n.udenPris > 0).length;
  const overforbrug = kunder.filter((k) => k.n.ledige < 0);

  const pakkeData = pakker.map((p) => {
    const linjer = kunder.flatMap((k) => k.customerProducts.filter((l) => l.productId === p.id));
    return {
      navn: p.name,
      kunder: new Set(linjer.map((l) => l.companyId)).size,
      licenser: linjer.reduce((s, l) => s + l.seats, 0),
      prissat: p.pricePerUserMonth != null,
      farve: findFarve(p.color).bg,
    };
  });

  const baand = [
    { baand: "100 % og op", antal: kunder.filter((k) => k.n.fuld).length, fuld: true },
    { baand: "80–99 %", antal: kunder.filter((k) => !k.n.fuld && (k.n.udnyttelse ?? 0) >= 0.8).length, fuld: false },
    { baand: "60–79 %", antal: kunder.filter((k) => (k.n.udnyttelse ?? 0) >= 0.6 && (k.n.udnyttelse ?? 0) < 0.8).length, fuld: false },
    { baand: "Under 60 %", antal: kunder.filter((k) => (k.n.udnyttelse ?? 1) < 0.6).length, fuld: false },
  ];

  const sagsvaerdi = (d: (typeof aabneSager)[number]) =>
    d.value ?? (d.seatDelta && d.product?.pricePerUserMonth ? d.seatDelta * d.product.pricePerUserMonth * 12 : null);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Kunder" value={tal(kunder.length)} sub={`${kunder.filter((k) => k.country === "Danmark").length} danske · ${kunder.filter((k) => k.country === "Færøerne").length} færøske`} />
        <StatCard label="Licenser" value={tal(seats)} sub={`${tal(aktive)} i brug`} />
        <StatCard label="Udnyttelse" value={procent(seats ? aktive / seats : null, 1)} sub={`${fulde} kunder uden ledig licens`} />
        <StatCard
          label="Årlig licensværdi"
          value={kroner(aarsvaerdi)}
          sub={udenPris > 0 ? `${udenPris} kunder mangler pakke — ikke med i tallet` : "på nuværende licenser"}
          highlight
        />
        <StatCard label="Åbne sager" value={tal(aabneSager.length)} sub={`${tal(aabneSager.reduce((s, d) => s + (d.seatDelta ?? 0), 0))} licenser i spil`} />
      </div>

      <p className="text-xs text-muted-foreground max-w-3xl flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Budgettet regnes udelukkende på de licenser kunderne har i dag. Antal ansatte og omsætning står på
        hver kunde som baggrundsviden om virksomhedens størrelse og indgår hverken i pris eller scope.
      </p>

      <HotWidget rows={hotte as any} />

      {udenPris > 0 && (
        <Card className="border-warning/40 bg-warning/[0.05]">
          <CardBody className="flex items-start gap-3">
            <TriangleAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{udenPris} kunder mangler pakkevalg</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Deres licenser tæller ikke med i licensværdien før de er sat på Small, Medium eller Large.{" "}
                <Link href="/produkter" className="text-primary hover:underline">Sæt pakker under Produkter</Link>.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {overforbrug.length > 0 && (
        <Card className="border-danger/40 bg-danger/[0.05]">
          <CardBody className="flex items-start gap-3">
            <TriangleAlert className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Flere aktive brugere end tildelte licenser</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                {overforbrug.map((k, i) => (
                  <span key={k.id}>
                    {i > 0 && ", "}
                    <Link href={`/kunder/${k.id}`} className="text-primary hover:underline">{k.name}</Link>{" "}
                    ({k.n.aktive} på {k.n.seats})
                  </span>
                ))}
                . Bør afklares i portalen.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Licenser pr. pakke" description="Sådan fordeler de nuværende licenser sig i dag." />
          <CardBody><PakkeDiagram data={pakkeData} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Udnyttelse af licenser" description="Aktive brugere mod tildelte licenser." />
          <CardBody><UdnyttelseDiagram data={baand} /></CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Største kunder efter licenser"
            description="Ansatte og omsætning står med som kontekst — hvor stor en virksomhed du sidder med."
            action={<Link href="/kunder" className="text-xs font-medium text-primary hover:underline">Alle kunder</Link>}
          />
          <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-5 py-2.5 font-medium">Kunde</th>
                  <th className="px-3 py-2.5 font-medium">Pakke</th>
                  <th className="px-3 py-2.5 font-medium text-right">Licenser</th>
                  <th className="px-3 py-2.5 font-medium text-right">Udnyt.</th>
                  <th className="px-3 py-2.5 font-medium text-right">Årsværdi</th>
                  <th className="px-3 py-2.5 font-medium text-right">Ansatte</th>
                  <th className="px-5 py-2.5 font-medium text-right">Omsætning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...kunder].sort((a, b) => b.n.seats - a.n.seats).slice(0, 12).map((k) => (
                  <tr key={k.id} className="hover:bg-secondary/60">
                    <td className="px-5 py-2.5">
                      <Link href={`/kunder/${k.id}`} className="font-medium hover:text-primary">{k.name}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {k.customerProducts[0] && (
                          <ProduktMaerke icon={k.customerProducts[0].product.icon} color={k.customerProducts[0].product.color} size="sm" />
                        )}
                        {k.customerProducts.map((l) => l.product.name).join(", ") || "–"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">{k.n.aktive} / {k.n.seats}</td>
                    <td className={`px-3 py-2.5 text-right tabular ${k.n.fuld ? "text-danger font-semibold" : ""}`}>{procent(k.n.udnyttelse)}</td>
                    <td className="px-3 py-2.5 text-right tabular">{k.n.aarsvaerdi > 0 ? kroner(k.n.aarsvaerdi) : "–"}</td>
                    <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{tal(k.employees)}</td>
                    <td className="px-5 py-2.5 text-right tabular text-muted-foreground">{millioner(k.revenueMdkk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Åbne salgsmuligheder"
            description="Dine egne scopes."
            action={<Link href="/pipeline" className="text-xs font-medium text-primary hover:underline">Se alle</Link>}
          />
          <CardBody className="p-0">
            {aabneSager.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Ingen åbne sager. Opret dem selv under <Link href="/pipeline" className="text-primary hover:underline">Pipeline</Link>.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {aabneSager.slice(0, 8).map((s) => (
                  <li key={s.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.company.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.title}
                        {sagsvaerdi(s) != null && ` · ${kroner(sagsvaerdi(s))}/år`}
                      </div>
                    </div>
                    <Badge variant="muted">{s.stage}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {indstillinger.dataSourceNote && (
        <p className="text-xs text-muted-foreground max-w-3xl">{indstillinger.dataSourceNote}</p>
      )}
    </div>
  );
}
