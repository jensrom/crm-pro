"use client";

import { useState } from "react";
import { dagTekst, fraIso, maanederMellem } from "@/lib/perioder";
import { kroner } from "@/lib/format";

/**
 * Én licens i "Tilkøb på SUB-nøgle". Viser restperioden fra startdatoen til
 * nøglens udløb og regner beløbet ud, mens man skriver:
 *   antal × pris pr. md. × påbegyndte måneder.
 * Serveren regner perioden igen ud fra nøglen — det her er kun visningen.
 */
export function TilkoebRaekke({
  productId,
  navn,
  info,
  pris,
  engang,
  udloeb,
  start,
  valgt = false,
}: {
  productId: string;
  navn: string;
  /** Kort tekst under navnet, fx "Nøglen har 3 · aftalt pris" */
  info: string;
  pris: number | null;
  /** Perpetual / engangsydelse: ingen periode */
  engang: boolean;
  /** Nøglens udløb (yyyy-mm-dd) */
  udloeb: string | null;
  /** Standard startdato (yyyy-mm-dd) */
  start: string;
  valgt?: boolean;
}) {
  const [med, setMed] = useState(valgt);
  const [antal, setAntal] = useState("1");
  const [p, setP] = useState(pris == null ? "" : String(pris).replace(".", ","));
  const [s, setS] = useState(start);

  const fra = fraIso(s);
  const til = fraIso(udloeb);
  const mdr = engang ? 1 : fra && til && til >= fra ? maanederMellem(fra, til) : 0;
  const n = Math.max(0, Number(antal) || 0);
  const pr = Number(p.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  const beloeb = Number.isFinite(pr) ? n * pr * mdr : null;
  const udloebet = !engang && fra && til && til < fra;

  const felt = "h-8 rounded-md border border-input bg-background px-2 text-xs tabular w-full";

  return (
    <li className={`px-5 py-3 grid grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_1fr_70px_100px_minmax(300px,1.3fr)] gap-x-3 gap-y-2 items-start ${med ? "bg-primary/[0.05]" : ""}`}>
      <input
        type="checkbox"
        name="tilkoeb"
        value={productId}
        checked={med}
        onChange={(e) => setMed(e.target.checked)}
        aria-label={`Tilkøb ${navn}`}
        className="mt-2 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
      />
      <div className="min-w-0 pt-1">
        <div className="text-sm font-medium">{navn}</div>
        <div className="text-xs text-muted-foreground">{info}</div>
      </div>
      <input
        name={`t_antal_${productId}`}
        type="number"
        min={1}
        value={antal}
        onChange={(e) => { setAntal(e.target.value); setMed(true); }}
        aria-label="Antal"
        className={`${felt} col-start-2 lg:col-start-auto`}
      />
      <input
        name={`t_pris_${productId}`}
        inputMode="decimal"
        value={p}
        onChange={(e) => { setP(e.target.value); setMed(true); }}
        placeholder="pris"
        aria-label={engang ? "Pris pr. licens" : "Pris pr. md."}
        className={`${felt} col-start-2 lg:col-start-auto`}
      />
      <div className="col-start-2 lg:col-start-auto flex flex-col gap-1">
        {engang ? (
          <span className="text-xs text-muted-foreground leading-8">Engangskøb — ingen restperiode</span>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <input
              type="date"
              name={`t_${productId}_start`}
              value={s}
              onChange={(e) => setS(e.target.value)}
              aria-label="Startdato"
              title="Tilkøbet starter"
              className={felt}
            />
            <span className="text-xs text-muted-foreground tabular whitespace-nowrap">
              → {til ? dagTekst(til) : "–"}
            </span>
          </div>
        )}
        <div className="text-xs tabular">
          {udloebet ? (
            <span className="text-danger">Nøglen er udløbet før startdatoen — forny den først.</span>
          ) : (
            <>
              <span className="text-muted-foreground">
                {n} × {Number.isFinite(pr) ? kroner(pr) : "–"}
                {!engang && <> × {mdr} {mdr === 1 ? "md." : "mdr."}</>} ={" "}
              </span>
              <b>{beloeb == null ? "–" : kroner(beloeb)}</b>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
