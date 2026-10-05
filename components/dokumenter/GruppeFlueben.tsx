"use client";

import { useEffect, useRef } from "react";

/**
 * Flueben for et helt produkt. Slår alle licenserne under det til/fra og
 * viser selv "delvist valgt", når kun nogle af dem er sat.
 * Licenserne er almindelige checkboxe med data-gruppe={gruppe}.
 */
export function GruppeFlueben({ gruppe, label }: { gruppe: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const boern = () =>
      Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][data-gruppe="${gruppe}"]`));
    const opdater = () => {
      const b = boern();
      const valgt = b.filter((x) => x.checked).length;
      if (!ref.current) return;
      ref.current.checked = b.length > 0 && valgt === b.length;
      ref.current.indeterminate = valgt > 0 && valgt < b.length;
    };
    opdater();
    document.addEventListener("change", opdater);
    return () => document.removeEventListener("change", opdater);
  }, [gruppe]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
      onChange={(e) => {
        const til = e.currentTarget.checked;
        document
          .querySelectorAll<HTMLInputElement>(`input[type=checkbox][data-gruppe="${gruppe}"]`)
          .forEach((x) => {
            x.checked = til;
          });
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}
