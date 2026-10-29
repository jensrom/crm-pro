"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { lavVarenummer } from "@/lib/varenummer";

/**
 * Navn og varenummer på en licens. Varenummeret følger navnet, mens man
 * skriver — skriver man selv et varenummer, bliver det stående.
 * Serveren sørger for, at nummeret er unikt (-2, -3 … hvis det er taget).
 */
export function NavnOgVarenummer({
  idPrefix,
  familie,
  navn = "",
  sku = "",
  automatisk = true,
  placeholder,
}: {
  idPrefix: string;
  familie: string | null;
  navn?: string;
  sku?: string;
  /** Følger varenummeret navnet i dag? */
  automatisk?: boolean;
  placeholder?: string;
}) {
  const [n, setN] = useState(navn);
  const [auto, setAuto] = useState(automatisk);
  const [s, setS] = useState(sku);
  const forslag = lavVarenummer(familie, n || "");
  const vist = auto ? (sku && n === navn ? sku : forslag) : s;

  return (
    <>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-navn`}>Navn</Label>
        <Input id={`${idPrefix}-navn`} name="name" value={n} onChange={(e) => setN(e.target.value)} required placeholder={placeholder} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-sku`} hint={auto ? "genereres af navnet" : "skrevet manuelt"}>Varenummer</Label>
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-sku`}
            name="sku"
            value={vist}
            onChange={(e) => { setAuto(false); setS(e.target.value.toUpperCase()); }}
            className="font-mono text-xs tracking-wide"
          />
          {!auto && (
            <button type="button" onClick={() => setAuto(true)} className="knap-glas shrink-0 h-10 px-3 rounded-md text-xs font-medium" title="Brug varenummeret genereret af navnet">
              Auto
            </button>
          )}
        </div>
        <input type="hidden" name="skuAuto" value={auto ? "1" : "0"} />
      </div>
    </>
  );
}
