import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import {
  gemAfsenderprofil,
  gemDokumentindstillinger,
  opretAfsenderprofil,
  sletAfsenderprofil,
} from "@/app/actions/indstillinger";

const BESKEDER: Record<string, string> = {
  gemt: "Dokumentindstillingerne er gemt.",
  "profil-oprettet": "Afsenderprofilen er oprettet. Tilknyt brugerne under Brugere.",
  "profil-gemt": "Afsenderprofilen er gemt.",
  "profil-slettet": "Afsenderprofilen er slettet.",
};
const FEJL: Record<string, string> = { "profil-navn": "Afsenderprofilen skal have et navn, fx Horsens." };

type Profil = Awaited<ReturnType<typeof db.senderProfile.findMany>>[number] & { _count: { users: number } };

/** Felterne på en afsenderprofil. Tomme felter arver de fælles oplysninger. */
function ProfilFelter({ p, fx }: { p?: Profil; fx: string }) {
  return (
    <>
      <div><Label htmlFor={`${fx}navn`}>Navn på profilen</Label><Input id={`${fx}navn`} name="name" required defaultValue={p?.name ?? ""} placeholder="fx Horsens" /></div>
      <div><Label htmlFor={`${fx}af`}>Afdeling (dokumenthoved)</Label><Input id={`${fx}af`} name="department" defaultValue={p?.department ?? ""} placeholder="fx Novotek A/S, Horsens" /></div>
      <div><Label htmlFor={`${fx}a`}>Adresse</Label><Input id={`${fx}a`} name="address" defaultValue={p?.address ?? ""} /></div>
      <div><Label htmlFor={`${fx}z`}>Postnr. og by</Label><Input id={`${fx}z`} name="zipCity" defaultValue={p?.zipCity ?? ""} placeholder="fx 8700 Horsens" /></div>
      <div><Label htmlFor={`${fx}t`}>Telefon (hovednummer)</Label><Input id={`${fx}t`} name="phone" defaultValue={p?.phone ?? ""} /></div>
      <div><Label htmlFor={`${fx}m`}>Mail (fælles)</Label><Input id={`${fx}m`} name="email" type="email" defaultValue={p?.email ?? ""} /></div>
      <details className="sm:col-span-2 group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Firmanavn, CVR, land, web og bank — kun hvis profilen afviger fra de fælles oplysninger</summary>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <div><Label htmlFor={`${fx}n`}>Firmanavn</Label><Input id={`${fx}n`} name="companyName" defaultValue={p?.companyName ?? ""} /></div>
          <div><Label htmlFor={`${fx}c`}>CVR</Label><Input id={`${fx}c`} name="cvr" defaultValue={p?.cvr ?? ""} /></div>
          <div><Label htmlFor={`${fx}l`}>Land</Label><Input id={`${fx}l`} name="country" defaultValue={p?.country ?? ""} /></div>
          <div><Label htmlFor={`${fx}w`}>Web</Label><Input id={`${fx}w`} name="website" defaultValue={p?.website ?? ""} /></div>
          <div className="sm:col-span-2"><Label htmlFor={`${fx}b`}>Bankoplysninger (én pr. linje)</Label><Textarea id={`${fx}b`} name="bankInfo" defaultValue={p?.bankInfo ?? ""} className="min-h-[70px]" /></div>
        </div>
      </details>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={p?.isDefault ?? false} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
        Standard — bruges for brugere uden afdeling
      </label>
      {p && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={p.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
          Aktiv — kan vælges
        </label>
      )}
    </>
  );
}

export const dynamic = "force-dynamic";

export default async function DokumentIndstillinger({ searchParams }: { searchParams: Promise<{ besked?: string; fejl?: string }> }) {
  const { besked, fejl } = await searchParams;
  const [s, profiler] = await Promise.all([
    db.settings.findUnique({ where: { id: "singleton" } }),
    db.senderProfile.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } },
    }),
  ]);
  const logoOk = !!s?.brandLogo?.match(/^data:image\/(png|jpe?g);/i);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">{BESKEDER[besked]}</CardBody></Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]"><CardBody className="text-sm">{FEJL[fejl]}</CardBody></Card>
      )}

      <div id="profiler" className="scroll-mt-20">
      <Card>
        <CardHeader
          title="Afsenderprofiler"
          description="Én profil pr. afdeling, fx Horsens og Glostrup. Brugerens afdeling vælger profilen på nye tilbud og ordrer. Navn, mail og telefon på sælgeren kommer altid fra den bruger, der opretter dokumentet."
        />
        <CardBody className="flex flex-col gap-3">
          {profiler.length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen profiler endnu. Dokumenterne bruger de fælles oplysninger herunder.</p>
          )}
          {profiler.map((p) => (
            <details key={p.id} className="rounded-lg border border-border">
              <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.isDefault && <Badge variant="info">Standard</Badge>}
                {!p.isActive && <Badge variant="muted">Inaktiv</Badge>}
                <span className="text-xs text-muted-foreground">
                  {[p.department, [p.address, p.zipCity].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{p._count.users} {p._count.users === 1 ? "bruger" : "brugere"}</span>
              </summary>
              <div className="border-t border-border p-4 flex flex-col gap-4">
                <form action={gemAfsenderprofil.bind(null, p.id)} className="grid sm:grid-cols-2 gap-4">
                  <ProfilFelter p={p} fx={`p${p.id}`} />
                  <div className="sm:col-span-2 flex items-center justify-end gap-3">
                    <GemtAf af={p.updatedBy} tid={p.updatedAt} className="mr-auto" />
                    <Button type="submit" size="sm">Gem profil</Button>
                  </div>
                </form>
                <form action={sletAfsenderprofil.bind(null, p.id)} className="flex justify-end">
                  <Button type="submit" size="sm" variant="secondary">Slet profil</Button>
                </form>
              </div>
            </details>
          ))}
          <details className="rounded-lg border border-dashed border-border" open={profiler.length === 0}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">+ Ny afsenderprofil</summary>
            <form action={opretAfsenderprofil} className="border-t border-border p-4 grid sm:grid-cols-2 gap-4">
              <ProfilFelter fx="ny" />
              <div className="sm:col-span-2 flex justify-end"><Button type="submit" size="sm">Opret profil</Button></div>
            </form>
          </details>
        </CardBody>
      </Card>
      </div>
      <form action={gemDokumentindstillinger} className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title="Fælles afsenderoplysninger"
            description="Bruges i dokumenterne, når afsenderprofilen ikke selv udfylder feltet — typisk firmanavn, CVR, web og bank."
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
