import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BekraeftSlet } from "@/components/ui/bekraeft-slet";
import { hentLogSkabeloner } from "@/lib/logskabeloner";
import { flytLogSkabelon, gemLogSkabelon, opretLogSkabelon, sletLogSkabelon } from "@/app/actions/logskabeloner";

export const dynamic = "force-dynamic";

/** Indstillinger → Salg. Foreløbig: hurtigteksterne til tilstandsloggen på kunden. */
export default async function SalgsIndstillinger() {
  const tekster = await hentLogSkabeloner(false);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Log skrivning"
          description={`Hurtigtekster til loggen under "Kundens tilstand". Et klik sætter teksten ind efter dato og initialer, fx "29/10/26 JPR: Mail sendt". Rækkefølgen her er rækkefølgen på kunden.`}
        />
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {tekster.map((t, i) => (
              <li key={t.id} className="px-5 py-2 flex items-center gap-2">
                <div className="flex flex-col">
                  <form action={flytLogSkabelon.bind(null, t.id, -1)}>
                    <button type="submit" disabled={i === 0} aria-label="Flyt op" className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  </form>
                  <form action={flytLogSkabelon.bind(null, t.id, 1)}>
                    <button type="submit" disabled={i === tekster.length - 1} aria-label="Flyt ned" className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </form>
                </div>
                <form key={t.id} action={gemLogSkabelon.bind(null, t.id)} className="flex-1 flex items-center gap-2">
                  <input type="hidden" name="sortOrder" value={t.sortOrder} />
                  <Input name="tekst" defaultValue={t.tekst} maxLength={120} aria-label="Tekst" className="h-9" />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <input type="checkbox" name="isActive" defaultChecked={t.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                    Vis
                  </label>
                  <Button size="sm" variant="secondary" type="submit">Gem</Button>
                </form>
                <form action={sletLogSkabelon.bind(null, t.id)}>
                  <BekraeftSlet hvad={`hurtigteksten "${t.tekst}"`} className="p-1.5 text-muted-foreground hover:text-danger" />
                </form>
              </li>
            ))}
            {tekster.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">Ingen hurtigtekster. Tilføj den første herunder.</li>}
          </ul>
          <form action={opretLogSkabelon} className="px-5 py-4 border-t border-border flex items-center gap-2">
            <Input name="tekst" required maxLength={120} placeholder="Ny hurtigtekst, fx Kontrakt sendt til underskrift" className="h-9" />
            <Button size="sm" type="submit"><Plus className="h-3.5 w-3.5" /> Tilføj</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
