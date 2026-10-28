"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gemUdseende } from "@/app/actions/indstillinger";
import { BAGGRUNDE, MAKS_STYRKE, MOENSTRE, STANDARD_BAGGRUND, STANDARD_STYRKE, type BaggrundId } from "@/lib/baggrunde";

const FORVALG = [
  { navn: "Svag", v: 20 },
  { navn: "Middel", v: 32 },
  { navn: "Tydelig", v: 48 },
];

/**
 * Baggrundsvalget med live forhåndsvisning: hele appens baggrundslag skifter
 * med, mens man vælger. Forlader man siden uden at gemme, sættes det tilbage.
 */
export function UdseendeForm({
  moenster: startMoenster,
  styrke: startStyrke,
  mobil: startMobil,
  harBillede,
  billedeUrl,
}: {
  moenster: BaggrundId;
  styrke: number;
  mobil: boolean;
  harBillede: boolean;
  billedeUrl: string | null;
}) {
  const [moenster, setMoenster] = useState<BaggrundId>(startMoenster);
  const [styrke, setStyrke] = useState(startStyrke);
  const [mobil, setMobil] = useState(startMobil);
  const [nytBillede, setNytBillede] = useState<string | null>(null);
  const [fjern, setFjern] = useState(false);
  const fil = useRef<HTMLInputElement>(null);

  const billede = nytBillede ?? (harBillede && !fjern ? billedeUrl : null);
  const css = (id: BaggrundId) => (id === "billede" ? (billede ? `url("${billede}")` : "none") : MOENSTRE[id]);

  // Live: appens baggrundslag følger valget
  useEffect(() => {
    const lag = document.getElementById("app-baggrund");
    if (!lag) return;
    const foer = { m: lag.style.getPropertyValue("--app-moenster"), s: lag.style.getPropertyValue("--app-styrke") };
    return () => {
      lag.style.setProperty("--app-moenster", foer.m);
      lag.style.setProperty("--app-styrke", foer.s);
    };
  }, []);
  useEffect(() => {
    const lag = document.getElementById("app-baggrund");
    lag?.style.setProperty("--app-moenster", css(moenster));
    lag?.style.setProperty("--app-styrke", String(styrke / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moenster, styrke, billede]);
  useEffect(() => () => { if (nytBillede) URL.revokeObjectURL(nytBillede); }, [nytBillede]);

  const pct = `${Math.round((styrke / MAKS_STYRKE) * 100)}%`;

  return (
    <form action={gemUdseende} className="flex flex-wrap gap-5 items-start">
      <div className="glas relative rounded-xl flex-[999_1_560px] min-w-0">
        <div className="px-5 pt-5 pb-4 border-b border-[color:var(--linje)]">
          <h2 className="text-base font-semibold">Baggrund</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-prose">
            En meget svag baggrund under hele appen. Den ligger bag glasset og giver dybde — tekst, tal og knapper påvirkes aldrig.
          </p>
        </div>

        <div className="px-5 py-5 flex flex-col gap-6">
          <fieldset>
            <legend className="sr-only">Vælg baggrund</legend>
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
              {[...BAGGRUNDE, { id: "billede" as const, navn: "Eget billede", note: "JPG, PNG eller WebP · højst 3 MB" }].map((b) => {
                const valgt = moenster === b.id;
                const erBillede = b.id === "billede";
                return (
                  <label key={b.id} className="flex flex-col gap-1.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="bgPattern"
                      value={b.id}
                      checked={valgt}
                      onChange={() => {
                        setMoenster(b.id);
                        if (erBillede && !billede) fil.current?.click();
                      }}
                      className="sr-only peer"
                    />
                    <span
                      className={cn(
                        "relative block h-28 rounded-xl overflow-hidden bg-background transition-transform group-hover:-translate-y-0.5",
                        "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--ring))]",
                        valgt
                          ? "shadow-[0_0_0_2px_#2a72c4,0_0_0_5px_rgba(42,114,196,.25),0_10px_24px_-8px_rgba(42,114,196,.5)]"
                          : "shadow-[0_0_0_1px_var(--kant),0_6px_16px_-8px_var(--skygge-tung)]"
                      )}
                    >
                      {erBillede && !billede ? (
                        <span className="absolute inset-0 grid place-items-center text-primary bg-[color:var(--hover)] shadow-[inset_0_0_0_1.5px_hsl(var(--primary))] rounded-xl">
                          <span className="flex flex-col items-center gap-1.5 text-xs font-semibold"><ImageUp className="h-6 w-6" />Upload billede</span>
                        </span>
                      ) : (
                        <>
                          <span aria-hidden className="absolute inset-0 opacity-75" style={{ background: css(b.id), backgroundSize: "cover", backgroundPosition: "center" }} />
                          <span aria-hidden className="glas absolute left-3.5 right-3.5 top-4 h-8 rounded-md" />
                          <span aria-hidden className="glas absolute left-3.5 w-[46%] top-14 h-8 rounded-md" />
                        </>
                      )}
                      {valgt && (
                        <span className="knap-glossy absolute right-2 top-2 h-6 w-6 rounded-full grid place-items-center">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-semibold">{b.navn}</span>
                    <span className="text-xs text-muted-foreground -mt-1">{b.note}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Filvælgeren til eget billede */}
          <div className={cn("flex flex-wrap items-center gap-3", moenster !== "billede" && !nytBillede && "hidden")}>
            <input
              ref={fil}
              type="file"
              name="bgFil"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm file:mr-3 file:h-9 file:px-3 file:rounded-md file:border-0 file:bg-secondary file:text-foreground file:font-medium file:cursor-pointer"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setNytBillede(URL.createObjectURL(f));
                  setMoenster("billede");
                  setFjern(false);
                }
              }}
            />
            {harBillede && !nytBillede && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" name="fjernBillede" checked={fjern} onChange={(e) => setFjern(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Fjern det nuværende billede
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="bgStrength" className="text-sm font-semibold">Styrke</label>
              <output htmlFor="bgStrength" className="font-serif text-lg font-bold tabular">{styrke} %</output>
            </div>
            <input
              id="bgStrength"
              name="bgStrength"
              type="range"
              min={0}
              max={MAKS_STYRKE}
              step={2}
              value={styrke}
              onChange={(e) => setStyrke(Number(e.target.value))}
              className="glas-skyder"
              style={{ ["--pct" as string]: pct }}
            />
            <div className="flex flex-wrap gap-2">
              {FORVALG.map((p) => (
                <Button key={p.v} type="button" size="sm" variant={styrke === p.v ? "primary" : "secondary"} aria-pressed={styrke === p.v} onClick={() => setStyrke(p.v)}>
                  {p.navn}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Anbefalet: 20–35 %. Højere styrke giver mere farve bag glasset, men kan gøre lange lister urolige.</p>
          </div>

          <div className="pt-4 border-t border-[color:var(--linje)]">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer min-h-8">
              <input type="checkbox" name="bgMobile" checked={mobil} onChange={(e) => setMobil(e.target.checked)} className="h-[18px] w-[18px] accent-[hsl(var(--primary))]" />
              Brug også baggrunden på telefon og tablet
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5 px-5 py-3.5 border-t border-[color:var(--linje)]">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setMoenster(STANDARD_BAGGRUND);
              setStyrke(STANDARD_STYRKE);
              setMobil(true);
              setNytBillede(null);
              if (fil.current) fil.current.value = "";
            }}
          >
            Nulstil
          </Button>
          <Button type="submit">Gem ændringer</Button>
        </div>
      </div>

      <aside className="glas relative rounded-xl flex-[1_1_300px] min-w-0 p-5 flex flex-col gap-3.5">
        <h2 className="text-base font-semibold">Forhåndsvisning</h2>
        <div className="relative h-64 rounded-xl overflow-hidden bg-background shadow-[inset_0_0_0_1px_var(--kant),inset_0_2px_8px_var(--skygge)]">
          <div aria-hidden className="absolute inset-0" style={{ background: css(moenster), backgroundSize: "cover", backgroundPosition: "center", opacity: `calc(${styrke / 100} * var(--baggrund-gang))` }} />
          <div className="relative p-4 grid grid-cols-2 gap-3">
            <div className="glas relative rounded-xl px-3.5 py-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kunder</div><div className="font-serif text-2xl font-bold tabular">43</div></div>
            <div className="glas relative rounded-xl px-3.5 py-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Licenser</div><div className="font-serif text-2xl font-bold tabular">262</div></div>
            <div className="glas relative rounded-xl px-3.5 py-3 col-span-2"><div className="text-sm font-semibold">Import af aktiver fra Excel fejler</div><div className="text-xs text-muted-foreground">Havnefront Fisk A/S · 2 dage</div></div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Hele appen skifter med, mens du vælger. Forlader du siden uden at gemme, vender den tilbage til det gemte.</p>
      </aside>
    </form>
  );
}
