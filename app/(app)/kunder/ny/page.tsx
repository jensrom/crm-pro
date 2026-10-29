import Link from "next/link";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { kraevSkriv } from "@/lib/auth";
import { db } from "@/lib/db";
import { opretKunde } from "@/app/actions/kunder";
import { kundeNavn, kundeNr, naesteKundenummer } from "@/lib/kundenr";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  navn: "Kunden skal have et navn.",
  konto: "Idus konto-id'et bruges allerede af en anden kunde. Ret det, eller lad feltet stå tomt.",
};

/**
 * Ny kunde. Samme firma må gerne oprettes flere gange — fx en afdeling med
 * egen fakturering — så navn og adresse tjekkes ikke for dubletter. Hver
 * kunde får sit eget kundenummer. ?som=<id> kopierer stamdata fra en kunde.
 */
export default async function NyKunde({ searchParams }: { searchParams: Promise<{ fejl?: string; som?: string }> }) {
  await kraevSkriv("kunder");
  const { fejl, som } = await searchParams;
  const [kilde, naeste] = await Promise.all([
    som ? db.company.findUnique({ where: { id: som } }) : null,
    naesteKundenummer(),
  ]);
  const familie = kilde
    ? await db.company.findMany({
        where: { name: kilde.name },
        select: { id: true, name: true, department: true, customerNumber: true },
        orderBy: { customerNumber: "asc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <Link href={kilde ? `/kunder/${kilde.id}` : "/kunder"} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {kilde ? kundeNavn(kilde) : "Alle kunder"}
        </Link>
        <h1 className="mt-1.5 text-xl font-semibold">{kilde ? "Ny afdeling" : "Ny kunde"}</h1>
        <p className="text-xs text-muted-foreground mt-1">Får kundenummer {kundeNr(naeste)}.</p>
      </div>

      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />{FEJL[fejl]}</CardBody>
        </Card>
      )}

      {familie.length > 0 && (
        <Card className="bg-secondary/40">
          <CardBody className="text-sm flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div>
              Stamdata er kopieret fra {kundeNavn(kilde!)}. Giv den nye kunde sin egen afdeling, så de kan skelnes på dokumenter og i lister.
              <ul className="mt-1.5 text-xs text-muted-foreground">
                {familie.map((k) => (
                  <li key={k.id}>{kundeNr(k.customerNumber)} · {kundeNavn(k)}</li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      <form action={opretKunde} className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Stamdata" description="Samme firmanavn og adresse må gerne findes i forvejen, fx en anden afdeling med egen fakturering." />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div><Label htmlFor="name">Firmanavn</Label><Input id="name" name="name" required defaultValue={kilde?.name ?? ""} /></div>
            <div>
              <Label htmlFor="department" hint="fx Økonomi, Lager Esbjerg">Afdeling</Label>
              <Input id="department" name="department" autoFocus={!!kilde} />
            </div>
            <div><Label htmlFor="orgNumber">CVR-nummer</Label><Input id="orgNumber" name="orgNumber" defaultValue={kilde?.orgNumber ?? ""} /></div>
            <div><Label htmlFor="industry">Branche</Label><Input id="industry" name="industry" defaultValue={kilde?.industry ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="address">Adresse</Label><Input id="address" name="address" defaultValue={kilde?.address ?? ""} /></div>
            <div><Label htmlFor="zipCode">Postnummer</Label><Input id="zipCode" name="zipCode" defaultValue={kilde?.zipCode ?? ""} /></div>
            <div><Label htmlFor="city">By</Label><Input id="city" name="city" defaultValue={kilde?.city ?? ""} /></div>
            <div>
              <Label htmlFor="country">Land</Label>
              <Select id="country" name="country" defaultValue={kilde?.country ?? "Danmark"}>
                <option>Danmark</option>
                <option>Færøerne</option>
                <option>Grønland</option>
                <option>Sverige</option>
                <option>Norge</option>
              </Select>
            </div>
            <div><Label htmlFor="accountId" hint="skal være unikt">Idus konto-id</Label><Input id="accountId" name="accountId" /></div>
            <div><Label htmlFor="email">Mail</Label><Input id="email" name="email" type="email" /></div>
            <div><Label htmlFor="phone">Telefon</Label><Input id="phone" name="phone" defaultValue={kilde?.phone ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="website">Website</Label><Input id="website" name="website" defaultValue={kilde?.website ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="notes">Noter</Label><Textarea id="notes" name="notes" className="min-h-[60px]" /></div>
          </CardBody>
        </Card>
        <div className="flex justify-end gap-2">
          <Link href={kilde ? `/kunder/${kilde.id}` : "/kunder"}><Button type="button" variant="secondary">Fortryd</Button></Link>
          <Button type="submit">Opret kunde</Button>
        </div>
      </form>
    </div>
  );
}
