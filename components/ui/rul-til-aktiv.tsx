"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Faner der ruller vandret (mobil): sørger for, at den aktive fane står synligt
 * i rækken, også når den ligger langt ude til højre.
 */
export function RulTilAktiv() {
  const sti = usePathname();
  const soeg = useSearchParams();
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".fanerække").forEach((raekke) => {
      const aktiv = raekke.querySelector<HTMLElement>('[aria-current="page"]');
      if (!aktiv || raekke.scrollWidth <= raekke.clientWidth) return;
      raekke.scrollTo({ left: aktiv.offsetLeft - (raekke.clientWidth - aktiv.offsetWidth) / 2, behavior: "auto" });
    });
  }, [sti, soeg]);
  return null;
}
