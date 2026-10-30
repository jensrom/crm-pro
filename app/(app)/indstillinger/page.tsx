import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { hentIndstillinger } from "@/lib/analysis";
import { db } from "@/lib/db";
import { tal } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { BekraeftSlet } from "@/components/ui/bekraeft-slet";
import { gemPipelineIndstilling } from "@/app/actions/salg";
import { bygDemomiljoeHandling, fjernDemodata, taelDemodata } from "@/app/actions/demodata";
import { STANDARD_AFSLUTTET_DAGE, afsluttetDage } from "@/lib/pipeline";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DEMO_BESKED: Record<string, string> = {
  indlaest: "Demodata er lagt ind.",
  fjernet: "Demodata er fjernet. Rigtige data er ikke rørt.",
  "ingen-kunder": "Der er ingen aktive kunder at lægge demodata på.",
  bygget: "Demomiljøet er bygget.",
  backup: "Sæt flueben ved, at du har hentet backuppen, før demomiljøet bygges.",
};

export default async function IndstillingerSide({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; antal?: string; produkter?: string; licenser?: string }>;
}) {
  const { demo, antal, produkter: nyeProdukter, licenser: nyeLicenser } = await searchParams;
  const [i, antalKunder, antalSager, pipe, demoAntal] = await Promise.all([
    hentIndstillinger(),
    db.company.count(),
    db.deal.count(),
    db.settings.findUnique({ where: { id: "singleton" }, select: { pipelineDoneDays: true } }),
    taelDemodata(),
  ]);
  const dage = afsluttetDage(pipe?.pipelineDoneDays);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Sådan regnes tallene"
          description="Ét princip, så du ved hvad du kigger på."
        />
        <CardBody className="flex flex-col gap-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            <b className="text-foreground">Budget bygger kun på nuværende licenser.</b> Årsværdi = tildelte licenser ×
            aftalt pris pr. bruger pr. måned × 12. Intet andet indgår.
          </p>
          <p>
            <b className="text-foreground">Firmastørrelse er baggrundsviden.</b> Antal ansatte og omsætning står på
            kunden så du ved hvor stor en virksomhed du sidder med. De bruges hverken til pris, pakkevalg eller scope.
          </p>
          <p>
            <b className="text-foreground">Scope bestemmer du.</b> Salgsmuligheder oprettes kun af dig. Vælger du pakke
            og antal licenser på en sag, regner den økonomien ud fra pakkens pris — men antallet er dit.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Pipeline — oprydning"
          description="Hvor længe en vundet eller tabt salgsmulighed står som Afsluttet på statusboardet, før den ryddes væk. Gælder kundesiden og den samlede pipeline. Intet slettes — ryddede kan altid vises igen."
        />
        <CardBody>
          <form action={gemPipelineIndstilling} className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Label htmlFor="pdd">Dage som afsluttet</Label>
              <Input id="pdd" name="pipelineDoneDays" type="number" min={0} max={365} defaultValue={dage} />
            </div>
            <Button size="sm" type="submit">Gem</Button>
            <span className="text-xs text-muted-foreground pb-2">0 = forsvinder med det samme. Standard er {STANDARD_AFSLUTTET_DAGE}.</span>
          </form>
        </CardBody>
      </Card>

      <Card>
        <div id="demomiljoe" className="scroll-mt-24" />
        <CardHeader
          title="Demomiljø"
          description="Sletter alle kunder og alt der hænger på dem og bygger 6 nye, fiktive kunder med mindst to af alt: kontakter, SUB-nøgler med abonnementer og perpetual-licenser, licenshistorik, salgsmuligheder, aktiviteter, notater, logbog, filer, tilbud og ordrer. Desuden 8 fiktive produkter med prishistorik og ydelser. Brugere, indstillinger og eksisterende licenser (fx Idus) røres ikke. Hver kørsel giver nye tilfældige data."
        />
        <CardBody className="flex flex-col gap-4">
          {demo && DEMO_BESKED[demo] && (
            <div className={demo === "backup" ? "rounded-lg bg-danger/[0.08] text-danger px-3 py-2 text-sm" : "rounded-lg bg-success/[0.08] px-3 py-2 text-sm"}>
              {DEMO_BESKED[demo]}
              {demo === "bygget" && antal ? ` ${antal} kunder, ${nyeProdukter ?? "8"} produkter og ${nyeLicenser ?? ""} licenser og ydelser er oprettet.` : ""}
              {demo === "indlaest" && antal ? ` ${antal} poster oprettet.` : ""}
            </div>
          )}
          <ol className="flex flex-col gap-3 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-3">
              <span><b>1.</b> Hent en backup af alle kunder, katalog, ordrer og filer ({tal(antalKunder)} kunder lige nu).</span>
              <a href="/api/backup" download>
                <Button size="sm" variant="secondary" type="button">Hent backup (JSON)</Button>
              </a>
            </li>
            <li>
              <form action={bygDemomiljoeHandling} className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2">
                  <b>2.</b>
                  <input type="checkbox" name="backup" value="1" required className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                  Jeg har hentet og gemt backuppen
                </label>
                <BekraeftSlet
                  hvad={`alle ${tal(antalKunder)} kunder og alt der hænger på dem`}
                  detalje="Kontakter, licenser, sager, tilbud, ordrer, filer og logbog slettes permanent. Bagefter bygges 6 nye demokunder. Det tager 10–30 sekunder."
                  className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-xs font-semibold knap-glossy"
                >
                  Byg demomiljø
                </BekraeftSlet>
              </form>
            </li>
          </ol>
          {demoAntal > 0 && (
            <form action={fjernDemodata} className="text-xs text-muted-foreground flex items-center gap-2">
              Ældre demoposter fra den gamle demofunktion: {tal(demoAntal)}.
              <BekraeftSlet hvad={`alle ${tal(demoAntal)} gamle demoposter`} className="underline hover:text-danger">Fjern dem</BekraeftSlet>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Databasen" description="Postgres hos Neon, koblet på Vercel-projektet." />
        <CardBody className="flex flex-col gap-3 text-sm">
          <Linje label="Kunder" vaerdi={tal(antalKunder)} />
          <Linje label="Salgsmuligheder" vaerdi={tal(antalSager)} />
          <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
            Neon tager selv løbende sikkerhedskopier og kan gendanne til et tidspunkt. Vil du have en kopi i hånden,
            så hent alt under <Link href="/indstillinger/eksport" className="text-primary hover:underline">Eksport</Link>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Linje({ label, vaerdi }: { label: string; vaerdi: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm tabular">{vaerdi}</span>
    </div>
  );
}
