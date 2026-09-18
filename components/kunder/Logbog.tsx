import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LOGTYPER, label } from "@/lib/labels";
import { dato } from "@/lib/format";
import { skiftFastgjort, skrivLog, sletLog } from "@/app/actions/teknik";
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  kind: string;
  content: string;
  pinned: boolean;
  author: string | null;
  createdAt: Date;
};

/**
 * Logbogen sidder øverst i højre spalte, fordi det er den man skal kunne
 * skrive i uden at lede — og det første man vil vide når man åbner en kunde.
 */
export function Logbog({ kundeId, poster }: { kundeId: string; poster: Post[] }) {
  const fastgjorte = poster.filter((p) => p.pinned);
  const oevrige = poster.filter((p) => !p.pinned);

  return (
    <Card>
      <CardHeader title="Logbog" description="Det korte referat. Hvad blev der sagt, aftalt eller bemærket?" />
      <CardBody className="p-0">
        <form action={skrivLog.bind(null, kundeId)} className="px-5 py-4 border-b border-border flex flex-col gap-2.5">
          <Textarea name="content" required placeholder="Skriv en linje…" className="min-h-[64px]" />
          <div className="flex items-center gap-2">
            <Select name="kind" defaultValue="note" aria-label="Type" className="w-32 h-8 text-xs">
              {LOGTYPER.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
            <Button size="sm" type="submit" className="ml-auto">Skriv i logbogen</Button>
          </div>
        </form>

        {poster.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Tom endnu. Første linje bliver den vigtigste om tre måneder.</p>
        ) : (
          <ul className="divide-y divide-border max-h-[560px] overflow-y-auto">
            {[...fastgjorte, ...oevrige].map((p) => (
              <li key={p.id} className={cn("px-5 py-3", p.pinned && "bg-primary/[0.04]")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap min-w-0">{p.content}</p>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <form action={skiftFastgjort.bind(null, p.id, kundeId, !p.pinned)}>
                      <button
                        type="submit"
                        aria-label={p.pinned ? "Frigør" : "Fastgør"}
                        title={p.pinned ? "Frigør" : "Fastgør øverst"}
                        className={cn("p-1 rounded hover:text-primary", p.pinned ? "text-primary" : "text-muted-foreground")}
                      >
                        {p.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                    </form>
                    <form action={sletLog.bind(null, p.id, kundeId)}>
                      <button type="submit" aria-label="Slet post" className="p-1 rounded text-muted-foreground hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{label(LOGTYPER, p.kind)}</span>
                  {p.author && <span>· {p.author}</span>}
                  <span className="tabular">· {dato(p.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
