import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { GemtAf } from "@/components/ui/gemt-af";
import { KUNDESTATUS, findKundestatus } from "@/lib/labels";
import { dato } from "@/lib/format";
import { skiftKundestatus } from "@/app/actions/kunder";

export function KundestatusKort({
  kundeId,
  status,
  note,
  sat,
  gemtAf,
  gemtTid,
}: {
  kundeId: string;
  status: string | null;
  note: string | null;
  sat: Date | null;
  gemtAf?: string | null;
  gemtTid?: Date | null;
}) {
  const s = findKundestatus(status);

  return (
    <Card>
      <CardHeader
        title="Kundens tilstand"
        description={sat ? `Sidst sat ${dato(sat)}` : "Ikke sat endnu"}
      />
      <CardBody>
        <form action={skiftKundestatus.bind(null, kundeId)} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {KUNDESTATUS.map((k) => (
              <label key={k.key} className="cursor-pointer">
                <input type="radio" name="customerStatus" value={k.key} defaultChecked={k.key === s.key} className="sr-only peer" />
                <span className="flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-lg border border-border bg-card text-xs text-muted-foreground transition-colors hover:bg-secondary peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  <span className="h-4 w-4 rounded" style={{ background: k.bg }} aria-hidden />
                  {k.label}
                </span>
              </label>
            ))}
          </div>
          <div>
            <Label htmlFor="statusnote">Hvorfor</Label>
            <Input id="statusnote" name="customerStatusNote" defaultValue={note ?? ""} placeholder="fx afventer svar på eskalering" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <GemtAf af={gemtAf} tid={gemtTid} />
            <Button size="sm" type="submit" className="ml-auto">Gem tilstand</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
