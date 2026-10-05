import { Download } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EksportSide() {
  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Eksport"
          description="Hele databasen som én JSON-fil: kunder, kontakter, licenser, tilkøb, sager, klippekort, logbog, notater, katalog, tilbud og ordrer."
        />
        <CardBody className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <a href="/api/eksport"><Button><Download className="h-4 w-4" /> Hent eksport</Button></a>
            <a href="/api/eksport?filer=1"><Button variant="secondary"><Download className="h-4 w-4" /> Med filboksens filer</Button></a>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            PIN-koder kommer ikke med. Neon tager desuden selv løbende sikkerhedskopier og kan gendanne databasen til et
            tidligere tidspunkt fra Neon-konsollen.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
