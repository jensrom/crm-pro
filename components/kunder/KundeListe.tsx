"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PRIORITET, findKundestatus } from "@/lib/labels";
import { kroner, millioner, procent, tal } from "@/lib/format";
import { ProduktMaerke } from "@/lib/produktstil";

export type Raekke = {
  id: string;
  name: string;
  country: string;
  industry: string | null;
  pakke: string;
  pakkeIkon: string | null;
  pakkeFarve: string | null;
  seats: number;
  aktive: number;
  udnyttelse: number | null;
  aarsvaerdi: number;
  udenPris: boolean;
  employees: number | null;
  revenueMdkk: number | null;
  priority: string | null;
  status: string | null;
  fuld: boolean;
  isHot: boolean;
};

type Noegle = keyof Raekke;

const KOLONNER: { key: Noegle; label: string; tal?: boolean; gruppe?: "kontekst" }[] = [
  { key: "name", label: "Kunde" },
  { key: "status", label: "Tilstand" },
  { key: "country", label: "Land" },
  { key: "industry", label: "Branche" },
  { key: "pakke", label: "Pakke" },
  { key: "seats", label: "Licenser", tal: true },
  { key: "aktive", label: "Aktive", tal: true },
  { key: "udnyttelse", label: "Udnyt.", tal: true },
  { key: "aarsvaerdi", label: "Årsværdi", tal: true },
  { key: "employees", label: "Ansatte", tal: true, gruppe: "kontekst" },
  { key: "revenueMdkk", label: "Omsætning", tal: true, gruppe: "kontekst" },
  { key: "priority", label: "Prioritet" },
];

export function KundeListe({ raekker, initialHotKun = false }: { raekker: Raekke[]; initialHotKun?: boolean }) {
  const [soeg, setSoeg] = useState("");
  const [land, setLand] = useState("alle");
  const [branche, setBranche] = useState("alle");
  const [pakke, setPakke] = useState("alle");
  const [hotKun, setHotKun] = useState(initialHotKun);
  const [noegle, setNoegle] = useState<Noegle>("seats");
  const [retning, setRetning] = useState(-1);

  const brancher = useMemo(
    () => Array.from(new Set(raekker.map((r) => r.industry).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "da-DK")),
    [raekker]
  );
  const pakker = useMemo(
    () => Array.from(new Set(raekker.map((r) => r.pakke))).sort((a, b) => a.localeCompare(b, "da-DK")),
    [raekker]
  );

  const synlige = useMemo(() => {
    const q = soeg.trim().toLowerCase();
    const ud = raekker.filter(
      (r) =>
        (land === "alle" || r.country === land) &&
        (branche === "alle" || r.industry === branche) &&
        (pakke === "alle" || r.pakke === pakke) &&
        (!hotKun || r.isHot) &&
        (!q || r.name.toLowerCase().includes(q))
    );
    ud.sort((a, b) => {
      const x = a[noegle];
      const y = b[noegle];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y, "da-DK") * retning;
      return (Number(x) - Number(y)) * retning;
    });
    return ud;
  }, [raekker, soeg, land, branche, pakke, hotKun, noegle, retning]);

  function sorter(k: Noegle) {
    if (k === noegle) setRetning((r) => -r);
    else {
      setNoegle(k);
      setRetning(typeof raekker[0]?.[k] === "string" ? 1 : -1);
    }
  }

  const sumSeats = synlige.reduce((s, r) => s + r.seats, 0);
  const sumVaerdi = synlige.reduce((s, r) => s + r.aarsvaerdi, 0);
  const manglerPris = synlige.filter((r) => r.udenPris).length;

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="flex flex-wrap items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <Input type="search" value={soeg} onChange={(e) => setSoeg(e.target.value)} placeholder="Søg kunde…" aria-label="Søg kunde" className="w-52" />
        <Select value={land} onChange={(e) => setLand(e.target.value)} aria-label="Filtrér på land" className="w-36">
          <option value="alle">Alle lande</option>
          <option value="Danmark">Danmark</option>
          <option value="Færøerne">Færøerne</option>
        </Select>
        <Select value={pakke} onChange={(e) => setPakke(e.target.value)} aria-label="Filtrér på pakke" className="w-44">
          <option value="alle">Alle pakker</option>
          {pakker.map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select value={branche} onChange={(e) => setBranche(e.target.value)} aria-label="Filtrér på branche" className="w-48">
          <option value="alle">Alle brancher</option>
          {brancher.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
        <button
          type="button"
          onClick={() => setHotKun((v) => !v)}
          aria-pressed={hotKun}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors",
            hotKun ? "border-orange-500 bg-orange-500/10 text-orange-600" : "border-border text-muted-foreground hover:bg-secondary"
          )}
        >
          <Flame className="h-3.5 w-3.5" />
          Hot
        </button>
        <div className="ml-auto text-xs text-muted-foreground tabular">
          {synlige.length} af {raekker.length} kunder · {tal(sumSeats)} licenser · {kroner(sumVaerdi)}/år
          {manglerPris > 0 && ` · ${manglerPris} uden pakke`}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
              {KOLONNER.map((k) => (
                <th key={k.key} className={cn("px-3 py-2.5 font-medium whitespace-nowrap", k.tal && "text-right", k.gruppe === "kontekst" && "text-muted-foreground/70")}>
                  <button onClick={() => sorter(k.key)} className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                    {k.label}
                    {noegle === k.key && <span aria-hidden>{retning === 1 ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {synlige.map((r) => {
              const p = r.priority ? PRIORITET[r.priority] : null;
              return (
                <tr key={r.id} className="hover:bg-secondary/60">
                  <td className="px-3 py-2.5 min-w-[190px]">
                    <Link href={`/kunder/${r.id}`} className="font-medium hover:text-primary inline-flex items-center gap-1.5">
                      {r.name}
                      {r.isHot && <Flame className="h-3.5 w-3.5 text-orange-500 shrink-0" aria-label="Hot" />}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: findKundestatus(r.status).bg }} aria-hidden />
                      {findKundestatus(r.status).label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.country}</td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{r.industry ?? "–"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <ProduktMaerke icon={r.pakkeIkon} color={r.pakkeFarve} size="sm" />
                      {r.udenPris ? <Badge variant="warning">{r.pakke}</Badge> : <span className="text-muted-foreground">{r.pakke}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{r.seats}</td>
                  <td className="px-3 py-2.5 text-right tabular">{r.aktive}</td>
                  <td className={cn("px-3 py-2.5 text-right tabular", r.fuld && "text-danger font-semibold")}>{procent(r.udnyttelse)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{r.aarsvaerdi > 0 ? kroner(r.aarsvaerdi) : "–"}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{tal(r.employees)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{millioner(r.revenueMdkk)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{p ? <Badge variant={p.variant}>{p.label}</Badge> : "–"}</td>
                </tr>
              );
            })}
            {synlige.length === 0 && (
              <tr><td colSpan={KOLONNER.length} className="px-5 py-10 text-center text-sm text-muted-foreground">Ingen kunder matcher filtrene.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
