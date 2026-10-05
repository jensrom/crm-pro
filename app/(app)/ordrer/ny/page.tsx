import Link from "next/link";
import { AlertTriangle, ArrowLeft, Boxes, FileText } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GruppeFlueben } from "@/components/dokumenter/GruppeFlueben";
import { db } from "@/lib/db";
import { ANTAL_FRIE_LINJER, hentAfsender, isoDato } from "@/lib/dokumenter";
import { hentKatalog, licensmodel, listepris } from "@/lib/katalog";
import { opretOrdre } from "@/app/actions/ordrer";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  modtager: "Ordren skal have en modtager.",
  linjer: "Sæt flueben ved mindst én licens, eller skriv en fri linje.",
};

/**
 * Ny ordrebekræftelse. Med ?kunde=<id> forudfyldes modtager, antal og aftalte
 * priser fra kunden — men intet er valgt på forhånd: du sætter selv flueben ved
 * de produkter og licenser, der skal med.
 */
export default async function NyOrdre({ searchParams }: { searchParams: Promise<{ kunde?: string; fejl?: string }> }) {
  const { kunde: kundeId, fejl } = await searchParams;

  const [kunder, kunde, { familier, uplacerede }, afsender] = await Promise.all([
    db.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    kundeId
      ? db.company.findUnique({
          where: { id: kundeId },
          include: {
            customerProducts: { where: { isActive: true } },
            contacts: { where: { isActive: true }, orderBy: [{ isPrimary: "desc" }] , take: 1 },
          },
        })
      : null,
    hentKatalog({ kunAktive: true }),
    hentAfsender(),
  ]);

  const grupper = [
    ...familier.map((f) => ({ id: f.id, navn: f.name, licenser: f.products })),
    ...(uplacerede.length ? [{ id: "uden", navn: "Uden produkt", licenser: uplacerede }] : []),
  ].filter((g) => g.licenser.length > 0);

  const kundeLinje = (pid: string) => kunde?.customerProducts.find((l) => l.productId === pid) ?? null;
  const kontakt = kunde?.contacts[0];
  const adresse = kunde ? [kunde.address, [kunde.zipCode, kunde.city].filter(Boolean).join(" "), kunde.country !== "Danmark" ? kunde.country : null].filter(Boolean).join("\n") : "";

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div>
        <Link href={kunde ? `/kunder/${kunde.id}` : "/ordrer"} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {kunde ? kunde.name : "Ordrebekræftelser"}
        </Link>
        <h1 className="mt-1.5 text-xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Ny ordrebekræftelse</h1>
      </div>

      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />{FEJL[fejl]}</CardBody>
        </Card>
      )}

      {/* Kundevalg genindlæser siden, så alt forudfyldes fra kunden */}
      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="w-80 max-w-full">
              <Label htmlFor="kunde">Kunde</Label>
              <Select id="kunde" name="kunde" defaultValue={kunde?.id ?? ""}>
                <option value="">Ingen kunde — fri modtager</option>
                {kunder.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>
            </div>
            <Button type="submit" size="sm" variant="secondary">Vælg</Button>
            <p className="text-xs text-muted-foreground">
              {kunde ? "Modtager, antal og aftalte priser er hentet fra kunden. PDF'en gemmes i kundens filboks." : "Uden kunde udfylder du selv modtageren. Ordren gemmes kun under Ordrebekræftelser."}
            </p>
          </form>
        </CardBody>
      </Card>

      <form action={opretOrdre} className="flex flex-col gap-5">
        {kunde && <input type="hidden" name="companyId" value={kunde.id} />}

        <Card>
          <CardHeader title="Modtager og ordre" />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div><Label htmlFor="rn">Firma / navn</Label><Input id="rn" name="recipientName" required defaultValue={kunde?.name ?? ""} /></div>
            <div><Label htmlFor="ra">Att.</Label><Input id="ra" name="recipientAttn" defaultValue={kontakt ? `${kontakt.firstName} ${kontakt.lastName}`.trim() : ""} /></div>
            <div><Label htmlFor="rd">Adresse</Label><Textarea id="rd" name="recipientAddress" defaultValue={adresse} className="min-h-[70px]" /></div>
            <div className="flex flex-col gap-4">
              <div><Label htmlFor="re">Mail</Label><Input id="re" name="recipientEmail" type="email" defaultValue={kontakt?.email ?? kunde?.email ?? ""} /></div>
              <div><Label htmlFor="rr">Jeres reference / PO</Label><Input id="rr" name="reference" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label htmlFor="od">Ordredato</Label><Input id="od" name="orderDate" type="date" defaultValue={isoDato(new Date())} /></div>
              <div><Label htmlFor="vr">Moms %</Label><Input id="vr" name="vatRate" inputMode="decimal" defaultValue={String(afsender.moms).replace(".", ",")} /></div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Hvad skal med?"
            description="Sæt flueben ved et produkt for at tage alle licenserne under det med, eller vælg licenserne enkeltvis. Subscription afregnes som antal × pris pr. md. × måneder; perpetual som antal × pris."
          />
          <CardBody className="p-0">
            <div className="hidden sm:grid grid-cols-[auto_1fr_80px_120px_80px] gap-x-3 px-5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="w-4" /><span /><span>Antal</span><span>Pris (kr.)</span><span>Mdr.</span>
            </div>
            {grupper.map((g) => (
              <div key={g.id} className="border-t border-border">
                <label className="flex items-center gap-2.5 px-5 py-2.5 bg-secondary/40 text-sm font-semibold">
                  <GruppeFlueben gruppe={g.id} label={`Alle licenser under ${g.navn}`} />
                  <Boxes className="h-4 w-4" /> {g.navn}
                </label>
                <ul className="divide-y divide-border">
                  {g.licenser.map((p) => {
                    const kl = kundeLinje(p.id);
                    const perpetual = p.licenseModel === "perpetual";
                    const pris = perpetual ? listepris(p) : kl?.unitPriceMonth ?? listepris(p);
                    return (
                      <li key={p.id} className="px-5 py-3 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_80px_120px_80px] gap-x-3 gap-y-2 items-center">
                        <input
                          type="checkbox"
                          name="vaelg"
                          value={p.id}
                          data-gruppe={g.id}
                          aria-label={`Medtag ${p.name}`}
                          className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                            {p.name}
                            {kl && <Badge variant="info">Kunden har {kl.seats}</Badge>}
                            {kl?.unitPriceMonth != null && !perpetual && <Badge variant="muted">Aftalt pris</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{licensmodel(p.licenseModel).label} · {licensmodel(p.licenseModel).enhed}</div>
                        </div>
                        <div className="col-start-2 sm:col-start-auto">
                          <Input name={`antal_${p.id}`} type="number" min={1} defaultValue={kl?.seats || 1} aria-label="Antal" className="h-8 text-xs" />
                        </div>
                        <div className="col-start-2 sm:col-start-auto">
                          <Input name={`pris_${p.id}`} inputMode="decimal" defaultValue={pris ?? ""} placeholder="pris" aria-label="Pris" className="h-8 text-xs" />
                        </div>
                        <div className="col-start-2 sm:col-start-auto">
                          {perpetual ? (
                            <span className="text-xs text-muted-foreground">Engang</span>
                          ) : (
                            <Input name={`mdr_${p.id}`} type="number" min={1} defaultValue={12} aria-label="Måneder" title="Måneder" className="h-8 text-xs" />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Frie linjer" description="Fx opsætning, kursus eller timer. Mdr. tom = engangsbeløb." />
          <CardBody className="flex flex-col gap-2.5">
            {Array.from({ length: ANTAL_FRIE_LINJER }, (_, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_80px_120px_80px] gap-2.5">
                <Input name={`fri_tekst_${i}`} placeholder="Beskrivelse" aria-label="Beskrivelse" className="col-span-2 sm:col-span-1" />
                <Input name={`fri_antal_${i}`} type="number" min={1} placeholder="Antal" aria-label="Antal" />
                <Input name={`fri_pris_${i}`} inputMode="decimal" placeholder="Pris" aria-label="Pris" />
                <Input name={`fri_mdr_${i}`} type="number" min={1} placeholder="Mdr." aria-label="Måneder" />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Label htmlFor="no">Bemærkninger på ordren</Label>
            <Textarea id="no" name="note" className="min-h-[70px]" placeholder="fx Leveres ved opstart 1. november" />
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Link href={kunde ? `/kunder/${kunde.id}` : "/ordrer"}><Button type="button" variant="secondary">Fortryd</Button></Link>
          <Button type="submit"><FileText className="h-4 w-4" /> Opret ordrebekræftelse</Button>
        </div>
      </form>
    </div>
  );
}
