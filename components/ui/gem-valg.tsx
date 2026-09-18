"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Dropdown + synlig Gem-knap.
 *
 * Baggrund: en <select> i en server-formular gemmer først når formularen
 * sendes. Uden en synlig knap sker der intet når man vælger — derfor denne.
 * Knappen tænder først når værdien faktisk er ændret, og siger "Gemmer…"
 * mens serveren arbejder.
 */

function GemKnap({ aendret }: { aendret: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={aendret ? "primary" : "secondary"}
      disabled={!aendret || pending}
      className="h-8 px-3 text-xs shrink-0"
    >
      {pending ? "Gemmer…" : "Gem"}
    </Button>
  );
}

export function GemValg({
  action,
  name,
  value,
  options,
  ariaLabel,
  selectClassName,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  value: string;
  options: readonly { key: string; label: string }[];
  ariaLabel?: string;
  selectClassName?: string;
  className?: string;
}) {
  const [valgt, setValgt] = useState(value);

  // Når serveren har gemt, kommer den nye værdi retur som prop — hold trit,
  // så knappen slukker igen i stedet for at blive hængende som "ændret".
  useEffect(() => setValgt(value), [value]);

  return (
    <form action={action} className={cn("flex items-center gap-1.5", className)}>
      <Select
        name={name}
        value={valgt}
        onChange={(e) => setValgt(e.target.value)}
        aria-label={ariaLabel}
        className={selectClassName}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </Select>
      <GemKnap aendret={valgt !== value} />
    </form>
  );
}
