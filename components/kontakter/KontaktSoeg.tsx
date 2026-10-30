"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Mail, Phone, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SoegKontakt = {
  id: string;
  navn: string;
  titel: string | null;
  rolle: string | null;
  email: string | null;
  telefon: string | null;
  primaer: boolean;
  kunde: { id: string; navn: string; afdeling: string | null; nummer: string; by: string | null } | null;
};

/** Små bogstaver uden accenter, så "torshavn" finder "Tórshavn" og "soren" finder "Søren". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Søgning i kontakter. Tom som standard; et søgeord matcher både personer
 * (navn, mail, telefon, stilling) og kunder (navn, afdeling, kundenr., by).
 * Matcher en kunde, vises alle dens kontakter. Resultatet grupperes pr. kunde.
 */
export function KontaktSoeg({ kontakter, start }: { kontakter: SoegKontakt[]; start: string }) {
  const [q, setQ] = useState(start);
  const felt = useRef<HTMLInputElement>(null);
  useEffect(() => felt.current?.focus(), []);
  // Søgeordet i adressen, så et tilbage-klik fra en kunde lander på samme søgning
  useEffect(() => {
    const u = new URL(window.location.href);
    if (q.trim()) u.searchParams.set("q", q.trim());
    else u.searchParams.delete("q");
    window.history.replaceState(null, "", u);
  }, [q]);

  const indeks = useMemo(
    () =>
      kontakter.map((c) => ({
        c,
        person: norm([c.navn, c.email, c.telefon, c.titel].filter(Boolean).join(" ")),
        kunde: norm([c.kunde?.navn, c.kunde?.afdeling, c.kunde?.nummer, c.kunde?.by].filter(Boolean).join(" ")),
      })),
    [kontakter]
  );

  const ord = norm(q).split(/\s+/).filter(Boolean);
  const grupper = useMemo(() => {
    if (!ord.length) return [];
    const fund = indeks.filter((x) => ord.every((o) => x.person.includes(o) || x.kunde.includes(o)));
    const m = new Map<string, { kunde: SoegKontakt["kunde"]; kundeMatch: boolean; kontakter: SoegKontakt[] }>();
    for (const x of fund) {
      const k = x.c.kunde?.id ?? "uden";
      if (!m.has(k)) m.set(k, { kunde: x.c.kunde, kundeMatch: ord.every((o) => x.kunde.includes(o)), kontakter: [] });
      m.get(k)!.kontakter.push(x.c);
    }
    return [...m.values()].sort((a, b) => (a.kunde?.navn ?? "~").localeCompare(b.kunde?.navn ?? "~", "da-DK"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indeks, ord.join(" ")]);
  const antal = grupper.reduce((s, g) => s + g.kontakter.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xl">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={felt}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søg på person eller kunde"
          aria-label="Søg i kontakter"
          className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {!ord.length ? (
        <p className="text-sm text-muted-foreground">
          Skriv et navn på en person eller en kunde. {kontakter.length} kontakter at søge i.
        </p>
      ) : antal === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Users className="h-5 w-5 mx-auto mb-2" />
          Ingen kontakter matcher “{q.trim()}”.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {antal} {antal === 1 ? "kontakt" : "kontakter"} hos {grupper.length} {grupper.length === 1 ? "kunde" : "kunder"}
          </p>
          {grupper.map((g) => (
            <div key={g.kunde?.id ?? "uden"} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 bg-secondary/40 border-b border-border flex flex-wrap items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {g.kunde ? (
                  <Link href={`/kunder/${g.kunde.id}?fane=kontakter`} className="font-semibold hover:text-primary">
                    {g.kunde.navn}
                    {g.kunde.afdeling && <span className="font-normal text-muted-foreground"> · {g.kunde.afdeling}</span>}
                  </Link>
                ) : (
                  <span className="font-semibold">Uden kunde</span>
                )}
                {g.kunde && <span className="text-xs text-muted-foreground tabular">{g.kunde.nummer}{g.kunde.by ? ` · ${g.kunde.by}` : ""}</span>}
                {g.kundeMatch && <Badge variant="muted">Kunden matcher</Badge>}
              </div>
              <ul className="divide-y divide-border">
                {g.kontakter.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-1 text-sm">
                    <div className="font-medium">
                      {c.navn}
                      {c.primaer && <Badge variant="info" className="ml-2">Primær</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground sm:pt-0.5">{[c.titel, c.rolle].filter(Boolean).join(" · ") || "–"}</div>
                    <div className="flex flex-col gap-0.5">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
                          <Mail className="h-3 w-3 shrink-0" />
                          {c.email}
                        </a>
                      )}
                      {c.telefon && (
                        <a href={`tel:${c.telefon}`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          {c.telefon}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
