import { Card, CardBody } from "@/components/ui/card";
import { KundeListe, type Raekke } from "@/components/kunder/KundeListe";
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
    const pakkenavne = linjer.map((l) => l.product.name);
    const foerste = linjer[0]?.product;
    return {
      id: k.id,
      name: k.name,
      country: k.country,
      industry: k.industry,
      pakke: pakkenavne.join(", ") || "Ingen",
      pakkeIkon: foerste?.icon ?? null,
      pakkeFarve: foerste?.color ?? null,
      seats: k.n.seats,
      aktive: k.n.aktive,
      udnyttelse: k.n.udnyttelse,
      aarsvaerdi: k.n.aarsvaerdi,
      udenPris: linjer.some((l) => gaeldendeMaanedspris(l.unitPriceMonth, l.product) == null),
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
