import { AlertTriangle, ImageIcon } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { hentIndstillinger } from "@/lib/analysis";
import { gemDatagrundlag, gemWhitelabel } from "@/app/actions/indstillinger";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  filtype: "Filtypen understøttes ikke. Brug PNG, JPG, SVG, WebP eller GIF.",
  stoerrelse: "Filen er for stor. Den må fylde højst 400 KB — et logo behøver sjældent mere.",
};

const BESKEDER: Record<string, string> = {
  gemt: "Udseendet er gemt.",
  note: "Noten om datagrundlaget er gemt.",
};

export default async function WhitelabelSide({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string; fejl?: string }>;
}) {
  const { besked, fejl } = await searchParams;
  const i = await hentIndstillinger();
  const undertekst = i.brandSubtitle ?? "Idus Online · DK & FO";
  const maerke = (i.brandMarkText ?? "CP").slice(0, 3);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">{BESKEDER[besked]}</CardBody>
        </Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            {FEJL[fejl]}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Udseende"
          description="Logo og undertekst i sidebjælken. Navnet CRM-Pro står fast."
        />
        <CardBody>
          <form action={gemWhitelabel} className="flex flex-col gap-5">
            {/* Sådan kommer det til at se ud */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-secondary/60 border-b border-border">
                Sådan ser det ud nu
              </div>
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ background: "hsl(var(--sidebar-bg))" }}
              >
                {i.brandLogo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={i.brandLogo} alt="Nuværende logo" className="h-7 w-7 rounded-md object-contain bg-white/90 p-0.5" />
                ) : (
                  <div className="h-7 w-7 rounded-md bg-primary grid place-items-center text-primary-foreground text-xs font-bold">
                    {maerke}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight" style={{ color: "hsl(var(--sidebar-fg-strong))" }}>CRM-Pro</div>
                  <div className="text-[10px] leading-tight truncate" style={{ color: "hsl(var(--sidebar-fg))" }}>
                    {undertekst}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="brandSubtitle">Undertekst</Label>
              <Input
                id="brandSubtitle"
                name="brandSubtitle"
                defaultValue={i.brandSubtitle ?? ""}
                placeholder="Idus Online · DK & FO"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Linjen under CRM-Pro. Lad den stå tom for at fjerne den helt.
              </p>
            </div>

            <div className="grid sm:grid-cols-[1fr_140px] gap-4 items-start">
              <div>
                <Label htmlFor="logo">Firmalogo</Label>
                <input
                  id="logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                  className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70 file:cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  PNG, JPG, SVG, WebP eller GIF, højst 400 KB. Kvadratisk virker bedst. Logoet gemmes i databasen,
                  så der er ingen filsti at holde styr på — en sikkerhedskopi af databasen indeholder også logoet.
                </p>
                {i.brandLogo && (
                  <label className="flex items-center gap-2 text-sm mt-3">
                    <input type="checkbox" name="fjernLogo" className="h-4 w-4 rounded border-input accent-[hsl(var(--destructive))]" />
                    Fjern logoet og brug bogstaverne i stedet
                  </label>
                )}
              </div>
              <div>
                <Label htmlFor="brandMarkText">Bogstaver</Label>
                <Input id="brandMarkText" name="brandMarkText" defaultValue={i.brandMarkText ?? ""} placeholder="CP" maxLength={3} />
                <p className="text-xs text-muted-foreground mt-1.5">Vises kun uden logo. Højst tre tegn.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4">
              <GemtAf af={i.updatedBy} tid={i.updatedAt} className="mr-auto" />
              <Button type="submit">Gem udseende</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Note om datagrundlaget"
          description="Vises nederst på dashboardet, så du og andre kan se hvor tallene stammer fra."
        />
        <CardBody>
          <form action={gemDatagrundlag} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="dataSourceNote">Note</Label>
              <Textarea id="dataSourceNote" name="dataSourceNote" defaultValue={i.dataSourceNote ?? ""} className="min-h-[120px]" />
            </div>
            <div className="flex items-center justify-end gap-4">
              <GemtAf af={i.updatedBy} tid={i.updatedAt} className="mr-auto" />
              <Button type="submit">Gem note</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <p className="text-xs text-muted-foreground flex items-start gap-2 max-w-prose">
        <ImageIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Selve navnet CRM-Pro er ikke sat op til at kunne ændres. Sig til hvis det også skal være et felt.
      </p>
    </div>
  );
}
