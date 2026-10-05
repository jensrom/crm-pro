"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [moerk, setMoerk] = useState(false);

  useEffect(() => {
    let gemt: string | null = null;
    try {
      gemt = localStorage.getItem("crmpro-tema");
    } catch {
      /* privat vindue eller blokeret lager — lys tilstand */
    }
    // Lys er standard. Mørk kun når brugeren selv har valgt det med knappen.
    const start = gemt === "dark";
    setMoerk(start);
    document.documentElement.classList.toggle("dark", start);
  }, []);

  function skift() {
    const ny = !moerk;
    setMoerk(ny);
    document.documentElement.classList.toggle("dark", ny);
    try {
      localStorage.setItem("crmpro-tema", ny ? "dark" : "light");
    } catch {
      /* kan ikke gemmes — temaet holder resten af sessionen */
    }
  }

  return (
    <button
      onClick={skift}
      aria-label={moerk ? "Skift til lyst tema" : "Skift til mørkt tema"}
      className="h-8 w-8 grid place-items-center rounded-lg border border-border hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {moerk ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
