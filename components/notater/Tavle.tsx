"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, GripVertical, Trash2 } from "lucide-react";
import { flytNotat, skiftFaerdig, sletNotat } from "@/app/actions/notater";
import { NOTAT_KOLONNER, findNotatprioritet, findSpor } from "@/lib/labels";
import { datoKort } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Kort = {
  id: string;
  title: string;
  details: string | null;
  lane: string;
  position: number;
  track: string;
  priority: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  author: string | null;
  company: { id: string; name: string } | null;
  /** Færdigskrevet "Sidst gemt af …" — teksten laves på serveren, hvor navnene er. */
  gemt: string | null;
};

/**
 * Tavlen. Kortene trækkes mellem kolonner, men hvert kort har også en
 * "flyt til"-menu — træk-og-slip virker ikke på touch, og tastaturbrugere
 * skal kunne det samme.
 */
export function Tavle({ kort, redigerHref }: { kort: Kort[]; redigerHref: (id: string) => string }) {
  const [liste, setListe] = useState(kort);
  const [traekker, setTraekker] = useState<string | null>(null);
  const [maal, setMaal] = useState<{ lane: string; indeks: number } | null>(null);
  const [venter, start] = useTransition();
  const kolonneRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Serverens svar vinder, når revalidate har hentet friske data.
  useEffect(() => setListe(kort), [kort]);

  const iKolonne = (lane: string) =>
    liste.filter((k) => k.lane === lane).sort((a, b) => a.position - b.position);

  function beregnIndeks(lane: string, y: number) {
    const el = kolonneRef.current[lane];
    if (!el) return 0;
    const kortEls = Array.from(el.querySelectorAll<HTMLElement>("[data-kort]"));
    let i = 0;
    for (const k of kortEls) {
      if (k.dataset.kort === traekker) continue;
      const r = k.getBoundingClientRect();
      if (y > r.top + r.height / 2) i++;
    }
    return i;
  }

  function slip(lane: string, indeks: number) {
    const id = traekker;
    setTraekker(null);
    setMaal(null);
    if (!id) return;

    // Flyt kortet med det samme, så tavlen ikke står stille mens serveren arbejder.
    setListe((gammel) => {
      const kortet = gammel.find((k) => k.id === id);
      if (!kortet) return gammel;
      const andre = gammel.filter((k) => k.id !== id);
      const kolonne = andre.filter((k) => k.lane === lane).sort((a, b) => a.position - b.position);
      kolonne.splice(Math.max(0, Math.min(indeks, kolonne.length)), 0, { ...kortet, lane });
      const nyePositioner = new Map(kolonne.map((k, i) => [k.id, i]));
      return andre
        .concat({ ...kortet, lane })
        .map((k) => (nyePositioner.has(k.id) ? { ...k, lane, position: nyePositioner.get(k.id)! } : k));
    });

    start(() => {
      flytNotat(id, lane, indeks);
    });
  }

  return (
    <div className={cn("grid gap-4 lg:grid-cols-4", venter && "opacity-95")}>
      {NOTAT_KOLONNER.map((kol) => {
        const kortene = iKolonne(kol.key);
        const aktivtMaal = maal?.lane === kol.key;
        return (
          <div
            key={kol.key}
            className={cn(
              "flex flex-col rounded-xl border bg-card/60 min-h-[220px] transition-colors",
              aktivtMaal ? "border-primary bg-primary/[0.04]" : "border-border"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setMaal({ lane: kol.key, indeks: beregnIndeks(kol.key, e.clientY) });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setMaal(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              slip(kol.key, beregnIndeks(kol.key, e.clientY));
            }}
          >
            <div className="px-4 py-3 border-b border-border flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{kol.label}</h2>
                <p className="text-xs text-muted-foreground">{kol.hjaelp}</p>
              </div>
              <span className="text-xs text-muted-foreground tabular">{kortene.length}</span>
            </div>

            <div
              ref={(el) => { kolonneRef.current[kol.key] = el; }}
              className="flex-1 p-2.5 flex flex-col gap-2"
            >
              {kortene.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {aktivtMaal ? "Slip her" : "Tom"}
                </p>
              )}

              {kortene.map((k, i) => {
                const faerdig = k.completedAt != null;
                const pr = findNotatprioritet(k.priority);
                const sp = findSpor(k.track);
                const forfalden = !faerdig && k.dueAt != null && new Date(k.dueAt) < new Date();
                return (
                  <div key={k.id}>
                    {aktivtMaal && maal?.indeks === i && <div className="h-0.5 rounded bg-primary mb-2" />}
                    <article
                      data-kort={k.id}
                      draggable
                      onDragStart={() => setTraekker(k.id)}
                      onDragEnd={() => { setTraekker(null); setMaal(null); }}
                      className={cn(
                        "group rounded-lg border bg-card p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing",
                        traekker === k.id && "opacity-40",
                        faerdig ? "border-border/60 opacity-55" : "border-border",
                        k.priority === "hoej" && !faerdig && "border-l-[3px] border-l-danger"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <form action={skiftFaerdig.bind(null, k.id, !faerdig)} className="shrink-0 pt-0.5">
                          <button
                            type="submit"
                            aria-label={faerdig ? `Genåbn ${k.title}` : `Markér ${k.title} som færdig`}
                            className={cn(
                              "h-4 w-4 rounded border grid place-items-center transition-colors",
                              faerdig
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-input text-transparent hover:border-primary hover:text-primary"
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </form>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={redigerHref(k.id)}
                            className={cn(
                              "text-sm font-medium leading-snug hover:text-primary block",
                              faerdig && "line-through text-muted-foreground"
                            )}
                          >
                            {k.title}
                          </Link>
                          {k.details && (
                            <p className={cn("text-xs text-muted-foreground mt-1 line-clamp-3", faerdig && "line-through")}>
                              {k.details}
                            </p>
                          )}
                        </div>

                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" aria-hidden />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                          style={{ background: faerdig ? "#94A3B8" : sp.bg }}
                        >
                          {sp.label}
                        </span>
                        {k.priority === "hoej" && !faerdig && (
                          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-danger/10 text-danger border border-danger/20">
                            {pr.label}
                          </span>
                        )}
                        {k.company && (
                          <Link href={`/kunder/${k.company.id}`} className="text-muted-foreground hover:text-primary truncate max-w-[140px]">
                            {k.company.name}
                          </Link>
                        )}
                        {k.dueAt && (
                          <span className={cn("tabular", forfalden ? "text-danger font-medium" : "text-muted-foreground")}>
                            {datoKort(k.dueAt)}
                          </span>
                        )}
                        {k.author && <span className="text-muted-foreground/70">{k.author}</span>}
                      </div>

                      {k.gemt && <p className="mt-1 text-[11px] text-muted-foreground/70">{k.gemt}</p>}

                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <select
                          aria-label={`Flyt ${k.title} til en anden kolonne`}
                          value={k.lane}
                          onChange={(e) => {
                            const lane = e.target.value;
                            setListe((g) => g.map((x) => (x.id === k.id ? { ...x, lane } : x)));
                            start(() => { flytNotat(k.id, lane, 0); });
                          }}
                          className="h-7 text-[11px] rounded-md border border-border bg-secondary px-1.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {NOTAT_KOLONNER.map((x) => (
                            <option key={x.key} value={x.key}>{x.label}</option>
                          ))}
                        </select>
                        <form action={sletNotat.bind(null, k.id)} className="ml-auto">
                          <button type="submit" aria-label={`Slet ${k.title}`} className="p-1 rounded text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </article>
                  </div>
                );
              })}

              {aktivtMaal && maal!.indeks >= kortene.length && kortene.length > 0 && (
                <div className="h-0.5 rounded bg-primary" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
