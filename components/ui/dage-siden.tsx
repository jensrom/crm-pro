"use client";

import { useEffect, useState } from "react";

/** Kalenderdage mellem to datoer i brugerens egen tidszone (browserens region). */
function dageImellem(fra: Date, til: Date) {
  const a = new Date(fra.getFullYear(), fra.getMonth(), fra.getDate());
  const b = new Date(til.getFullYear(), til.getMonth(), til.getDate());
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export function dageTekst(n: number) {
  if (n === 0) return "i dag";
  if (n === 1) return "i går";
  if (n === -1) return "i morgen";
  return n > 0 ? `${n} dage siden` : `om ${-n} dage`;
}

/**
 * "12 dage siden" ud fra en dato, regnet i brugerens tidszone. Udregnes i
 * browseren, så serverens tidszone ikke flytter dagen; indtil da vises intet.
 */
export function DageSiden({ dato, className }: { dato: string; className?: string }) {
  const [tekst, setTekst] = useState<string | null>(null);
  useEffect(() => {
    setTekst(dageTekst(dageImellem(new Date(dato), new Date())));
  }, [dato]);
  return (
    <span className={className} title={new Date(dato).toLocaleDateString("da-DK")} suppressHydrationWarning>
      {tekst ?? " "}
    </span>
  );
}
