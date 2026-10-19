import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { hentIndstillinger } from "@/lib/analysis";
import { db } from "@/lib/db";
import { kroner, tal } from "@/lib/format";
import { licensmodel, listepris } from "@/lib/katalog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { BekraeftSlet } from "@/components/ui/bekraeft-slet";
import { gemPipelineIndstilling } from "@/app/actions/salg";
import { fjernDemodata, indlaesDemodata, taelDemodata } from "@/app/actions/demodata";
import { STANDARD_AFSLUTTET_DAGE, afsluttetDage } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const DEMO_BESKED: Record<string, string> = {
  indlaest: "Demodata er lagt ind.",
  fjernet: "Demodata er fjernet. Rigtige data er ikke rørt.",
  "ingen-kunder": "Der er ingen aktive kunder at lægge demodata på.",
};

export default async function IndstillingerSide({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; antal?: string }>;
}) {
  const { demo, antal } = await searchParams;
  const [i, antalKunder, antalSager, produkter, pipe, demoAntal] = await Promise.all([
    hentIndstillinger(),
    db.company.count(),
    db.deal.count(),
    db.product.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
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
          title="Listepriser"
          description="Aktive licenser. Priser ændres med en prisændring i Katalog."
          action={<Link href="/indstillinger/katalog" className="text-xs font-medium text-primary hover:underline">Til katalog</Link>}
        />
        <CardBody className="flex flex-col gap-2.5">
          {produkter.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 text-sm">
              <span>{p.name}</span>
              <span className="tabular">
                {listepris(p) != null ? `${kroner(listepris(p))} ${licensmodel(p.licenseModel).enhed}` : "ingen pris"}
              </span>
            </div>
          ))}
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
        <CardHeader
          title="Demodata"
          description="Fiktive sager spredt over kunderne: leads og opportunities i alle stadier, teknik-sager med forskellig status og prioritet, notater og logbogsposter. Alt demodata er mærket og kan fjernes igen uden at røre rigtige data."
        />
        <CardBody className="flex flex-col gap-3">
          {demo && DEMO_BESKED[demo] && (
            <div className="rounded-lg bg-success/[0.08] px-3 py-2 text-sm">
              {DEMO_BESKED[demo]}{demo === "indlaest" && antal ? ` ${antal} poster oprettet.` : ""}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <form action={indlaesDemodata}>
              <Button size="sm" type="submit">{demoAntal > 0 ? "Indlæs demodata igen" : "Indlæs demodata"}</Button>
            </form>
            {demoAntal > 0 && (
              <form action={fjernDemodata}>
                <BekraeftSlet hvad={`alle ${tal(demoAntal)} demoposter`} detalje="Kun poster mærket som demodata fjernes. Rigtige data røres ikke." className="h-8 px-3 text-xs font-medium border border-border bg-secondary hover:text-danger">Fjern demodata</BekraeftSlet>
              </form>
            )}
            <span className="text-xs text-muted-foreground">
              {demoAntal > 0 ? `${tal(demoAntal)} demoposter i databasen nu.` : "Ingen demodata i databasen."}
            </span>
          </div>
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
