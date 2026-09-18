import Link from "next/link";
import { CheckCircle2, RefreshCw, Rocket, ShieldQuestion } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StiInput } from "@/components/ui/sti-input";
import { tjekOpdatering } from "@/lib/opdatering";
import { gemOpdateringsplacering } from "@/app/actions/opdatering";

export const dynamic = "force-dynamic";

const BESKEDER: Record<string, string> = {
  gemt: "Stien er gemt. Siden tjekker nu mod den.",
  fjernet: "Stien er ryddet. Opdateringstjekket er slået fra.",
};

export default async function OpdateringSide({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string }>;
}) {
  const { besked } = await searchParams;
  const status = tjekOpdatering();

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">{BESKEDER[besked]}</CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Denne installation" description="Hvad der kører lige nu." />
        <CardBody className="flex flex-col gap-3 text-sm">
          <Raek label="Version" vaerdi={<code className="text-xs">{status.installeret}</code>} />
        </CardBody>
      </Card>

      {status.fejl === "ikke_sat" && (
        <Card className="border-border">
          <CardBody className="flex items-start gap-3 text-sm text-muted-foreground">
            <ShieldQuestion className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Opdateringstjekket er ikke sat op endnu. Peg det på <code>version.json</code> — filen{" "}
              <code>npm run dist</code> skriver automatisk ved siden af de bygget exe-filer — så siden her kan
              fortælle dig når der ligger en nyere version.
            </span>
          </CardBody>
        </Card>
      )}

      {status.fejl === "ikke_fundet" && (
        <Card className="border-warning/50 bg-warning/[0.05]">
          <CardBody className="text-sm">
            Finder ikke filen på <code className="text-xs break-all">{status.sti}</code>. Er fællesdrevet
            tilgængeligt lige nu, og ligger <code>version.json</code> stadig derovre?
          </CardBody>
        </Card>
      )}

      {status.fejl === "ugyldig" && (
        <Card className="border-warning/50 bg-warning/[0.05]">
          <CardBody className="text-sm">
            Filen på <code className="text-xs break-all">{status.sti}</code> kunne ikke læses som gyldig
            version.json. Er det den fil <code>npm run dist</code> skrev, uændret?
          </CardBody>
        </Card>
      )}

      {!status.fejl && !status.erNyereTilgaengelig && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="flex items-start gap-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <span>Du kører den nyeste version ({status.installeret}).</span>
          </CardBody>
        </Card>
      )}

      {!status.fejl && status.erNyereTilgaengelig && status.nyeste && (
        <Card className="border-primary/50 bg-primary/[0.05]">
          <CardHeader
            title={<span className="flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" />Ny version tilgængelig</span>}
          />
          <CardBody className="flex flex-col gap-2.5 text-sm">
            <Raek label="Ny version" vaerdi={<Badge variant="default">{status.nyeste.version}</Badge>} />
            {status.nyeste.udgivet && <Raek label="Udgivet" vaerdi={status.nyeste.udgivet} />}
            {status.nyeste.fil && <Raek label="Fil" vaerdi={<code className="text-xs break-all">{status.nyeste.fil}</code>} />}
            {status.nyeste.noter && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2.5 leading-relaxed">{status.nyeste.noter}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Hent den nye exe fra samme mappe som <code>version.json</code> ligger i, og erstat den gamle.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Sti til version.json"
          description="Peg på manifest-filen npm run dist skriver. Typisk samme fællesdrev som databasen."
          action={
            <Link href="/indstillinger/opdatering">
              <Button size="sm" variant="secondary"><RefreshCw className="h-3.5 w-3.5" /> Tjek igen</Button>
            </Link>
          }
        />
        <CardBody>
          <form action={gemOpdateringsplacering} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="updateManifestPath">Sti til version.json</Label>
              <StiInput
                id="updateManifestPath"
                name="updateManifestPath"
                defaultValue={status.sti}
                dialogMode="open"
                filterType="manifest"
                dialogTitel="Vælg version.json"
                placeholder="\\\\dkfil01\\faelles\\CRM-Pro\\releases\\version.json"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Tom sti slår tjekket fra. Ligger databasen allerede på et fællesdrev (jf. DELING.md), er en{" "}
                <code>releases</code>-mappe ved siden af et naturligt sted.
              </p>
            </div>
            <div className="flex justify-end"><Button type="submit">Gem sti</Button></div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function Raek({ label, vaerdi }: { label: string; vaerdi: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right min-w-0">{vaerdi}</span>
    </div>
  );
}
