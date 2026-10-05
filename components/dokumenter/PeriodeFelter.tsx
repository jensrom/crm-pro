"use client";

import { useState } from "react";
import { fraIso, isoDag, maanederMellem, slutFraMaaneder, dagTekst } from "@/lib/perioder";

export type SynkMaal = { label: string; slut: string };

/**
 * Periodeudregner til en ordrelinje: startdato, antal måneder og slutdato.
 *
 *  • Ret start eller måneder → slutdatoen regnes ud.
 *  • Ret slutdatoen → antal måneder regnes ud (påbegyndt måned tæller som hel).
 *  • "Synk"-knapperne sætter slutdatoen til en eksisterende aftales udløb,
 *    så en ekstra licens kommer til at følge de andres løbetid.
 *  • 12/24/36 sætter en hel aftaleperiode fra startdatoen.
 */
export function PeriodeFelter({
  prefix,
  start,
  maaneder,
  slut,
  synk = [],
  kompakt = false,
}: {
  prefix: string;
  start: string;
  maaneder: number | null;
  slut?: string;
  synk?: SynkMaal[];
  kompakt?: boolean;
}) {
  const [s, setS] = useState(start);
  const [m, setM] = useState<string>(maaneder == null ? "" : String(maaneder));
  const [e, setE] = useState(
    slut ?? (maaneder && fraIso(start) ? isoDag(slutFraMaaneder(fraIso(start)!, maaneder)) : "")
  );

  const fraM = (ns: string, nm: string) => {
    const d = fraIso(ns);
    const n = Number(nm);
    if (d && Number.isFinite(n) && n > 0) setE(isoDag(slutFraMaaneder(d, n)));
  };
  const fraE = (ns: string, ne: string) => {
    const d = fraIso(ns);
    const t = fraIso(ne);
    if (d && t) setM(String(maanederMellem(d, t)));
  };

  const input = "h-8 rounded-md border border-input bg-background px-2 text-xs tabular w-full";

  return (
    <div className="flex flex-col gap-1.5">
      <div className={kompakt ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-[1fr_70px_1fr] gap-1.5"}>
        <input
          type="date"
          name={`${prefix}start`}
          value={s}
          aria-label="Startdato"
          title="Startdato"
          className={input}
          onChange={(ev) => {
            setS(ev.target.value);
            fraM(ev.target.value, m);
          }}
        />
        <input
          type="number"
          min={1}
          name={`${prefix}mdr`}
          value={m}
          aria-label="Måneder"
          title="Måneder der faktureres"
          placeholder="mdr."
          className={input}
          onChange={(ev) => {
            setM(ev.target.value);
            fraM(s, ev.target.value);
          }}
        />
        <input
          type="date"
          name={`${prefix}slut`}
          value={e}
          aria-label="Slutdato"
          title="Sidste dag i perioden"
          className={input}
          onChange={(ev) => {
            setE(ev.target.value);
            fraE(s, ev.target.value);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {[12, 24, 36].map((n) => (
          <button
            key={n}
            type="button"
            className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-primary hover:border-primary"
            onClick={() => {
              setM(String(n));
              fraM(s, String(n));
            }}
          >
            {n} mdr.
          </button>
        ))}
        {synk.map((t) => {
          const d = fraIso(s);
          const ts = fraIso(t.slut);
          const n = d && ts ? maanederMellem(d, ts) : null;
          return (
            <button
              key={t.label + t.slut}
              type="button"
              title={`Sæt slutdato til ${dagTekst(ts)}, så linjen følger aftalens løbetid`}
              className="rounded border border-primary/40 bg-primary/[0.06] px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10"
              onClick={() => {
                setE(t.slut);
                fraE(s, t.slut);
              }}
            >
              {t.label} {dagTekst(ts)}{n ? ` (${n} mdr.)` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
