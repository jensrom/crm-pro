import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { hentLogSkabeloner } from "@/lib/logskabeloner";
import { TilstandsLog } from "@/components/kunder/TilstandsLog";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { GemtAf } from "@/components/ui/gemt-af";
import { KUNDESTATUS, findKundestatus } from "@/lib/labels";
import { dato } from "@/lib/format";
import { skiftKundestatus } from "@/app/actions/kunder";

/** "29/10/26" i dansk tid, uanset serverens tidszone. */
const kortDato = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "2-digit", month: "2-digit", year: "2-digit" });

export async function KundestatusKort({
  kundeId,
  status,
  note,
  sat,
  gemtAf,
  gemtTid,
  kanSkrive = true,
}: {
  kundeId: string;
  status: string | null;
  note: string | null;
  sat: Date | null;
  gemtAf?: string | null;
  gemtTid?: Date | null;
  kanSkrive?: boolean;
}) {
  const s = findKundestatus(status);
  const [poster, skabeloner, mig] = await Promise.all([
    db.logEntry.findMany({ where: { companyId: kundeId, kind: "tilstand" }, orderBy: { createdAt: "desc" }, take: 100 }),
    hentLogSkabeloner(),
    hentSession(),
  ]);

  return (
    <Card>
      <CardHeader
        title="Kundens tilstand"
        description={sat ? `Sidst sat ${dato(sat)}` : "Ikke sat endnu"}
      />
      <CardBody>
        <form action={skiftKundestatus.bind(null, kundeId)} className="flex flex-col gap-3">
          <fieldset disabled={!kanSkrive} className="contents">
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
          <div className="flex items-center justify-between gap-3">
            <GemtAf af={gemtAf} tid={gemtTid} />
            <Button size="sm" type="submit" className="ml-auto">Gem tilstand</Button>
          </div>
        </fieldset>
        </form>
        <div className="mt-4 pt-4 border-t border-border">
          <TilstandsLog
            kundeId={kundeId}
            initialer={mig?.initials ?? ""}
            kanSkrive={kanSkrive}
            skabeloner={skabeloner.map((t) => t.tekst)}
            linjer={poster.map((p) => ({ id: p.id, dato: kortDato.format(p.createdAt).replace(/\./g, "/"), af: p.author, tekst: p.content }))}
          />
        </div>
      </CardBody>
    </Card>
  );
}
