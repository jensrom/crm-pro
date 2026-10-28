import { AlertTriangle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { UdseendeForm } from "@/components/indstillinger/UdseendeForm";
import { hentIndstillinger } from "@/lib/analysis";
import { gyldigBaggrund, gyldigStyrke } from "@/lib/baggrunde";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  filtype: "Filtypen understøttes ikke. Brug JPG, PNG eller WebP.",
  stoerrelse: "Billedet er for stort. Det må fylde højst 3 MB — gem det fx som JPG i 1920×1080.",
};

export default async function UdseendeSide({ searchParams }: { searchParams: Promise<{ besked?: string; fejl?: string }> }) {
  const { besked, fejl } = await searchParams;
  const i = await hentIndstillinger();

  return (
    <div className="max-w-6xl flex flex-col gap-5">
      {besked === "gemt" && (
        <Card className="toning-groen"><CardBody className="text-sm">Udseendet er gemt og gælder nu for alle brugere.</CardBody></Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40">
          <CardBody className="text-sm flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />{FEJL[fejl]}</CardBody>
        </Card>
      )}
      <UdseendeForm
        moenster={gyldigBaggrund(i.bgPattern)}
        styrke={gyldigStyrke(i.bgStrength)}
        mobil={i.bgMobile}
        harBillede={i.bgHarBillede}
        billedeUrl={i.bgHarBillede ? `/api/baggrund?v=${i.updatedAt?.getTime() ?? 0}` : null}
      />
    </div>
  );
}
