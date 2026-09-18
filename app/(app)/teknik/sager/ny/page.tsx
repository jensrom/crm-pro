import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { SAGSPRIORITET, SAGSSTATUS } from "@/lib/labels";
import { opretSag } from "@/app/actions/teknik";

export const dynamic = "force-dynamic";

export default async function NySag({ searchParams }: { searchParams: Promise<{ kunde?: string }> }) {
  const { kunde } = await searchParams;
  const [kunder, produkter] = await Promise.all([
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <Link href="/teknik/sager" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Alle sager
      </Link>

      <Card>
        <CardHeader title="Ny sag" description="Kunde og titel er nok til at komme i gang." />
        <CardBody>
          <form action={opretSag} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="companyId">Kunde</Label>
              <Select id="companyId" name="companyId" required defaultValue={kunde ?? ""}>
                <option value="" disabled>Vælg kunde…</option>
                {kunder.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="title">Titel</Label><Input id="title" name="title" required placeholder="fx Rapport fejler ved eksport" /></div>
            <div>
              <Label htmlFor="priority">Prioritet</Label>
              <Select id="priority" name="priority" defaultValue="normal">
                {SAGSPRIORITET.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="aaben">
                {SAGSSTATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="productId">Produkt</Label>
              <Select id="productId" name="productId" defaultValue="">
                <option value="">Ikke angivet</option>
                {produkter.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div><Label htmlFor="dueAt">Aftalt frist</Label><Input id="dueAt" name="dueAt" type="date" /></div>
            <div className="sm:col-span-2"><Label htmlFor="description">Beskrivelse</Label><Textarea id="description" name="description" className="min-h-[110px]" placeholder="Hvad er der sket, og hvad er aftalt?" /></div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Link href="/teknik/sager"><Button variant="secondary" type="button">Fortryd</Button></Link>
              <Button type="submit">Opret sag</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
