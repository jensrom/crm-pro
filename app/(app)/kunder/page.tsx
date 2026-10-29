import { Card, CardBody } from "@/components/ui/card";
import { KundeListe, type Raekke, type KundeProdukt } from "@/components/kunder/KundeListe";

type Produkt = KundeProdukt & { sortering: number };
import { hentKunderMedNoegletal } from "@/lib/analysis";
import { gaeldendeMaanedspris } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function KunderSide({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string; navn?: string; hot?: string }>;
}) {
  const { besked, navn, hot } = await searchParams;
  const { kunder } = await hentKunderMedNoegletal();

  const raekker: Raekke[] = kunder.map((k) => {
    const linjer = k.customerProducts;
    // Ét mærke pr. produkt (fx Idus, Fiix) — licenserne under produktet samles i mærket
    const produkter = new Map<string, Produkt>();
    for (const l of linjer) {
      const fam = l.product.family;
      const noegle = fam?.id ?? `licens-${l.productId}`;
      const p = produkter.get(noegle) ?? {
        navn: fam?.name ?? l.product.name,
        ikon: l.product.icon,
        farve: l.product.color,
        licenser: 0,
        linjer: [],
        udenPris: false,
        sortering: fam?.sortOrder ?? 999,
      };
      p.licenser += l.seats;
      p.linjer.push(`${l.seats} × ${l.product.name}`);
      if (gaeldendeMaanedspris(l.unitPriceMonth, l.product) == null) p.udenPris = true;
      produkter.set(noegle, p);
    }
    const liste = [...produkter.values()].sort((a, b) => a.sortering - b.sortering || a.navn.localeCompare(b.navn, "da-DK"));
    return {
      id: k.id,
      name: k.name,
      country: k.country,
      industry: k.industry,
      produkter: liste.map(({ sortering: _s, ...p }) => p),
      produktTekst: liste.map((p) => p.navn).join(", ") || "Ingen",
      seats: k.n.seats,
      aktive: k.n.aktive,
      udnyttelse: k.n.udnyttelse,
      aarsvaerdi: k.n.aarsvaerdi,
      udenPris: liste.some((p) => p.udenPris),
      employees: k.employees,
      revenueMdkk: k.revenueMdkk,
      priority: k.priority,
      status: k.customerStatus,
      fuld: k.n.fuld,
      isHot: (k as any).isHot ?? false,
    };
  });

  return (
    <div className="flex flex-col gap-5 max-w-[1500px]">
      {besked === "slettet" && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">
            {navn ? `“${decodeURIComponent(navn)}” er slettet.` : "Kunden er slettet."}
          </CardBody>
        </Card>
      )}
      <p className="text-sm text-muted-foreground max-w-3xl">
        Alle kunder fra Idus Online-portalen. Årsværdien regnes på de licenser de har i dag.
        Ansatte og omsætning står med som baggrundsviden om virksomhedens størrelse — de indgår ikke i tallene.
      </p>
      <KundeListe raekker={raekker} initialHotKun={hot === "1"} />
    </div>
  );
}
