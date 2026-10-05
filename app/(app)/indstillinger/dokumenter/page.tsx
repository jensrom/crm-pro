import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import { gemDokumentindstillinger } from "@/app/actions/indstillinger";

export const dynamic = "force-dynamic";

export default async function DokumentIndstillinger({ searchParams }: { searchParams: Promise<{ besked?: string }> }) {
  const { besked } = await searchParams;
  const s = await db.settings.findUnique({ where: { id: "singleton" } });
  const logoOk = !!s?.brandLogo?.match(/^data:image\/(png|jpe?g);/i);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      {besked === "gemt" && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">Dokumentindstillingerne er gemt.</CardBody></Card>
      )}
      <form action={gemDokumentindstillinger} className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title="Afsender"
            description="Står i toppen og bunden af licensbeviser og ordrebekræftelser."
          />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label htmlFor="n">Firmanavn</Label><Input id="n" name="docCompanyName" defaultValue={s?.docCompanyName ?? ""} placeholder="fx Novotek Danmark A/S" /></div>
            <div><Label htmlFor="af">Afdeling (dokumenthoved)</Label><Input id="af" name="docDepartment" defaultValue={s?.docDepartment ?? ""} placeholder="fx Novotek A/S, Horsens" /></div>
            <div><Label htmlFor="c">CVR</Label><Input id="c" name="docCvr" defaultValue={s?.docCvr ?? ""} /></div>
            <div><Label htmlFor="a">Adresse</Label><Input id="a" name="docAddress" defaultValue={s?.docAddress ?? ""} /></div>
            <div><Label htmlFor="z">Postnr. og by</Label><Input id="z" name="docZipCity" defaultValue={s?.docZipCity ?? ""} /></div>
            <div><Label htmlFor="l">Land</Label><Input id="l" name="docCountry" defaultValue={s?.docCountry ?? ""} placeholder="Danmark" /></div>
            <div><Label htmlFor="m">Mail</Label><Input id="m" name="docEmail" type="email" defaultValue={s?.docEmail ?? ""} /></div>
            <div><Label htmlFor="t">Telefon</Label><Input id="t" name="docPhone" defaultValue={s?.docPhone ?? ""} /></div>
            <div><Label htmlFor="w">Web</Label><Input id="w" name="docWebsite" defaultValue={s?.docWebsite ?? ""} /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="b">Bankoplysninger i brevfoden (én pr. linje)</Label>
              <Textarea id="b" name="docBankInfo" defaultValue={s?.docBankInfo ?? ""} className="min-h-[80px]" placeholder={"Account: Danske Bank - XXXX XXXXXXXX\nIBAN: DKXXXXXXXXXXXXXXXX\nSWIFT: XXXXXX\nVAT NO: DKXXXXXXXX"} />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Logoet er det samme som under Whitelabel.{" "}
              {s?.brandLogo
                ? logoOk ? "Det bruges i dokumenterne." : "Det er ikke PNG eller JPG, så dokumenterne viser firmanavnet i stedet."
                : "Der er intet logo, så dokumenterne viser firmanavnet."}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ordrebekræftelse" />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label htmlFor="p">Betalingsbetingelser (bruges kun, hvis produkterne ikke har egne betingelser)</Label><Input id="p" name="docPaymentTerms" defaultValue={s?.docPaymentTerms ?? ""} placeholder="fx Netto 30 dage" /></div>
            <div className="sm:col-span-2"><Label htmlFor="o">Betingelser nederst på ordren (bruges kun, hvis produkterne ikke har egne betingelser)</Label><Textarea id="o" name="docOrderText" defaultValue={s?.docOrderText ?? ""} className="min-h-[90px]" /></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Licensbevis" />
          <CardBody>
            <Label htmlFor="cv">Vilkår på licensbeviset</Label>
            <Textarea id="cv" name="docCertText" defaultValue={s?.docCertText ?? ""} className="min-h-[90px]" placeholder="fx Licenserne er personlige og må ikke overdrages. Brug er underlagt de gældende licensbetingelser." />
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {s && <GemtAf af={s.updatedBy} tid={s.updatedAt} />}
          <Button type="submit">Gem dokumentindstillinger</Button>
        </div>
      </form>
    </div>
  );
}
