import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { hentIndstillinger } from "@/lib/analysis";
import { db } from "@/lib/db";
import { kroner, tal } from "@/lib/format";
import { licensmodel, listepris } from "@/lib/katalog";

export const dynamic = "force-dynamic";

export default async function IndstillingerSide() {
  const [i, antalKunder, antalSager, produkter] = await Promise.all([
    hentIndstillinger(),
    db.company.count(),
    db.deal.count(),
    db.product.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

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
        <CardHeader title="Databasen" description="CRM-Pro kører på én SQLite-fil. Ingen server, ingen sky." />
        <CardBody className="flex flex-col gap-3 text-sm">
          <Linje label="Placering" vaerdi={<code className="text-xs">prisma/crm-pro.db</code>} />
          <Linje label="Kunder" vaerdi={tal(antalKunder)} />
          <Linje label="Salgsmuligheder" vaerdi={tal(antalSager)} />
          <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
            Sikkerhedskopi er en filkopi: luk appen og kopiér <code>prisma/crm-pro.db</code>. <code>npm run db:seed</code>{" "}
            henter kunderne ind igen og opdaterer licensantal fra portaludtrækket — den rører ikke dine egne noter,
            prioriteter eller pakkevalg. <code>npm run db:reset</code> tømmer alt og starter forfra.
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
