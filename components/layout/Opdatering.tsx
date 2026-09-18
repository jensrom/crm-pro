"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { klokken } from "@/lib/format";

/**
 * "Opdateret 14:32" med en genopfrisk-knap, og en stille automatik bagved.
 *
 * Der er ingen forbindelse mellem to CRM-Pro-installationer — de deler kun
 * databasefilen. Derfor kan Michaels indtastning ikke skubbes over på din
 * skærm; den skal hentes. Det er præcis hvad det her gør, med jævne mellemrum.
 *
 * Tre steder holder den igen, så den ikke arbejder i vejen for dig:
 *   · vinduet er skjult — der er ingen der kigger
 *   · markøren står i et felt — du er midt i at skrive noget
 *   · en genopfriskning er allerede i gang
 */

const INTERVAL_MS = 20_000;

/** Står markøren i noget man kan skrive i? Så lader vi være. */
function skriverBrugeren() {
  const e = document.activeElement as HTMLElement | null;
  if (!e) return false;
  if (e.isContentEditable) return true;
  const t = e.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
}

export function Opdatering() {
  const router = useRouter();
  const sti = usePathname();
  const [venter, start] = useTransition();
  const [sidst, setSidst] = useState<Date | null>(null);
  const [tik, setTik] = useState(0);
  const varVenter = useRef(false);

  // Førstegangsvisning og hver gang man skifter side: data er lige hentet.
  useEffect(() => setSidst(new Date()), [sti]);

  // Når en genopfriskning falder til ro, er tallene på skærmen nye.
  useEffect(() => {
    if (varVenter.current && !venter) setSidst(new Date());
    varVenter.current = venter;
  }, [venter]);

  // Får "for 3 min. siden"-teksten til at leve uden at hente noget.
  useEffect(() => {
    const id = setInterval(() => setTik((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const opdater = useCallback(() => start(() => router.refresh()), [router, start]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || skriverBrugeren()) return;
      opdater();
    }, INTERVAL_MS);

    // Kommer man tilbage til vinduet, vil man se det nyeste med det samme.
    const vedFokus = () => {
      if (!skriverBrugeren()) opdater();
    };
    window.addEventListener("focus", vedFokus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", vedFokus);
    };
  }, [opdater]);

  const alder = sidst ? Math.floor((Date.now() - sidst.getTime()) / 60_000) : 0;
  const gammel = alder >= 2;
  void tik; // får alderen til at blive genberegnet

  return (
    <button
      type="button"
      onClick={opdater}
      disabled={venter}
      title="Hent de nyeste data. Sker også af sig selv hvert 20. sekund."
      aria-label="Opdater"
      className={[
        "flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg border text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
        gammel ? "border-warning/50 text-warning" : "border-border text-muted-foreground hover:bg-secondary",
      ].join(" ")}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${venter ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline tabular">
        {venter ? "Opdaterer…" : sidst ? `Opdateret ${klokken(sidst)}` : "Opdater"}
      </span>
    </button>
  );
}
