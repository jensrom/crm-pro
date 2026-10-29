"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { skrivTilstandslog } from "@/app/actions/kunder";

export type LogLinje = { id: string; dato: string; af: string | null; tekst: string };

/** "29/10/26" — dagens dato som i loggen, i brugerens egen tidszone. */
function idag() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Tilstandsloggen under "Kundens tilstand": én linje pr. post, nyeste øverst.
 * "+" åbner en linje med dato og initialer udfyldt ("29/10/26 JPR: "), så man
 * bare skriver videre. Hurtigteksterne (Indstillinger → Salg) sættes ind med ét klik.
 */
export function TilstandsLog({
  kundeId,
  initialer,
  linjer,
  skabeloner,
  kanSkrive,
}: {
  kundeId: string;
  initialer: string;
  linjer: LogLinje[];
  skabeloner: string[];
  kanSkrive: boolean;
}) {
  const [aaben, setAaben] = useState(false);
  const [alle, setAlle] = useState(false);
  const [tekst, setTekst] = useState("");
  const [gemmer, setGemmer] = useState(false);
  const felt = useRef<HTMLInputElement>(null);
  const prefiks = `${idag()} ${initialer}: `;

  const aabn = () => {
    setTekst(prefiks);
    setAaben(true);
    requestAnimationFrame(() => {
      felt.current?.focus();
      felt.current?.setSelectionRange(prefiks.length, prefiks.length);
    });
  };
  const indsaet = (t: string) => {
    setTekst((nu) => {
      const krop = nu.startsWith(prefiks) ? nu.slice(prefiks.length) : nu;
      return prefiks + (krop.trim() ? `${krop.trimEnd()} — ${t}` : t);
    });
    felt.current?.focus();
  };
  const synlige = alle ? linjer : linjer.slice(0, 5);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Log</span>
        {kanSkrive && !aaben && (
          <button type="button" onClick={aabn} aria-label="Ny log-linje" title="Ny linje med dato og initialer" className="knap-glas h-6 w-6 grid place-items-center rounded-md">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {aaben && (
        <form
          action={async (fd) => {
            setGemmer(true);
            await skrivTilstandslog(kundeId, fd);
            setGemmer(false);
            setAaben(false);
            setTekst("");
          }}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              ref={felt}
              name="tekst"
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAaben(false)}
              maxLength={520}
              aria-label="Log-linje"
              className="felt h-8 flex-1 min-w-0 px-2.5 text-sm rounded-md"
            />
            <button type="submit" disabled={gemmer || tekst.trim() === prefiks.trim()} className="knap-glossy h-8 px-3 rounded-md text-xs font-semibold disabled:opacity-50">
              {gemmer ? "Gemmer…" : "Gem"}
            </button>
            <button type="button" onClick={() => setAaben(false)} aria-label="Fortryd" className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {skabeloner.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skabeloner.map((s) => (
                <button key={s} type="button" onClick={() => indsaet(s)} className="h-6 px-2 rounded-sm border border-border bg-secondary/50 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary">
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>
      )}

      {linjer.length === 0 ? (
        !aaben && <p className="text-xs text-muted-foreground">Ingen linjer endnu{kanSkrive ? " — tryk + for at skrive den første." : "."}</p>
      ) : (
        <ul className="rounded-md border border-border divide-y divide-border text-[13px] bg-background/40">
          {synlige.map((l) => (
            <li key={l.id} className="px-2.5 py-1.5 flex gap-2 leading-snug">
              <span className="tabular text-muted-foreground shrink-0">{l.dato}</span>
              {l.af && <span className="font-semibold shrink-0">{l.af}:</span>}
              <span className="min-w-0 break-words">{l.tekst}</span>
            </li>
          ))}
        </ul>
      )}
      {linjer.length > 5 && (
        <button type="button" onClick={() => setAlle((v) => !v)} className="self-start text-xs text-primary hover:underline">
          {alle ? "Vis færre" : `Vis alle ${linjer.length}`}
        </button>
      )}
    </div>
  );
}
