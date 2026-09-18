import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import { gemKunde } from "@/app/actions/kunder";
import { KONFIDENS, PRIORITET } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function RedigerKunde({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await db.company.findUnique({ where: { id } });
  if (!k) notFound();

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <Link href={`/kunder/${k.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Tilbage til {k.name}
        </Link>
        <h1 className="mt-1.5 text-xl font-semibold">Rediger kunde</h1>
      </div>

      <form action={gemKunde.bind(null, k.id)} className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Stamdata" />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label htmlFor="name">Navn</Label><Input id="name" name="name" defaultValue={k.name} required /></div>
            <div><Label htmlFor="orgNumber">CVR-nummer</Label><Input id="orgNumber" name="orgNumber" defaultValue={k.orgNumber ?? ""} /></div>
            <div><Label htmlFor="industry">Branche</Label><Input id="industry" name="industry" defaultValue={k.industry ?? ""} /></div>
            <div>
              <Label htmlFor="country">Land</Label>
              <Select id="country" name="country" defaultValue={k.country}>
                <option>Danmark</option>
                <option>Færøerne</option>
                <option>Grønland</option>
                <option>Sverige</option>
                <option>Norge</option>
              </Select>
            </div>
            <div><Label htmlFor="city">By</Label><Input id="city" name="city" defaultValue={k.city ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="address">Adresse</Label><Input id="address" name="address" defaultValue={k.address ?? ""} /></div>
            <div><Label htmlFor="zipCode">Postnummer</Label><Input id="zipCode" name="zipCode" defaultValue={k.zipCode ?? ""} /></div>
            <div><Label htmlFor="phone">Telefon</Label><Input id="phone" name="phone" defaultValue={k.phone ?? ""} /></div>
            <div><Label htmlFor="email">Mail</Label><Input id="email" name="email" type="email" defaultValue={k.email ?? ""} /></div>
            <div><Label htmlFor="website">Website</Label><Input id="website" name="website" defaultValue={k.website ?? ""} /></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Firmastørrelse" description="Ansatte og omsætning driver potentiale-beregningen. Skriv altid kilden på." />
          <CardBody className="grid sm:grid-cols-2 gap-4">
            <div><Label htmlFor="employees">Antal ansatte</Label><Input id="employees" name="employees" type="number" min={0} defaultValue={k.employees ?? ""} /></div>
            <div><Label htmlFor="revenueMdkk">Omsætning (mio. kr.)</Label><Input id="revenueMdkk" name="revenueMdkk" inputMode="decimal" defaultValue={k.revenueMdkk ?? ""} /></div>
            <div>
              <Label htmlFor="sizeConfidence">Konfidens</Label>
              <Select id="sizeConfidence" name="sizeConfidence" defaultValue={k.sizeConfidence ?? ""}>
                <option value="">Ikke angivet</option>
                {Object.entries(KONFIDENS).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Prioritet</Label>
              <Select id="priority" name="priority" defaultValue={k.priority ?? ""}>
                <option value="">Ikke angivet</option>
                {Object.entries(PRIORITET).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="sourceUrl">Kilde-URL</Label><Input id="sourceUrl" name="sourceUrl" defaultValue={k.sourceUrl ?? ""} /></div>
            <div className="sm:col-span-2"><Label htmlFor="sizeNote">Bemærkning om enheden</Label><Textarea id="sizeNote" name="sizeNote" defaultValue={k.sizeNote ?? ""} /></div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Interne noter" />
          <CardBody><Textarea name="notes" defaultValue={k.notes ?? ""} placeholder="Alt du vil huske om kunden." /></CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <GemtAf af={k.updatedBy} tid={k.updatedAt} className="mr-auto" />
          <Link href={`/kunder/${k.id}`}><Button variant="secondary" type="button">Fortryd</Button></Link>
          <Button type="submit">Gem ændringer</Button>
        </div>
      </form>
    </div>
  );
}
