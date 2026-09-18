"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

/**
 * Rammen om kundetabellen: fluebenene sidder på rækkerne, og bjælken nederst
 * samler dem op. Alt sendes som én almindelig formular, så det virker uden JavaScript —
 * tælleren og vælg-alle er bare bekvemmelighed ovenpå.
 */
export function BatchFlyt({
  action,
  produkter,
  nuvaerende,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  produkter: { id: string; name: string }[];
  nuvaerende: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [antal, setAntal] = useState(0);

  const taelOp = useCallback(() => {
    const f = formRef.current;
    if (!f) return;
    const bokse = f.querySelectorAll<HTMLInputElement>('input[name="linjeId"]');
    setAntal(Array.from(bokse).filter((b) => b.checked).length);
  }, []);

  function vaelgAlle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = formRef.current;
    if (!f) return;
    f.querySelectorAll<HTMLInputElement>('input[name="linjeId"]').forEach((b) => {
      b.checked = e.target.checked;
    });
    taelOp();
  }

  const maal = produkter.filter((p) => p.id !== nuvaerende);

  return (
    <form ref={formRef} action={action} onChange={taelOp}>
      <div className="border-b border-border px-5 py-2.5 flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            onChange={vaelgAlle}
            aria-label="Vælg alle kunder på listen"
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
          />
          Vælg alle
        </label>
        <span className="text-xs text-muted-foreground tabular">
          {antal === 0 ? "ingen valgt" : `${antal} valgt`}
        </span>
      </div>

      {children}

      <div className="border-t border-border px-5 py-3 flex flex-wrap items-center gap-3">
        <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm">Flyt de valgte til</span>
        <Select name="productId" aria-label="Produkt at flytte til" className="w-52" defaultValue="">
          <option value="" disabled>Vælg produkt…</option>
          {maal.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Button type="submit" disabled={antal === 0}>
          Flyt {antal > 0 ? `${antal} kunder` : "valgte"}
        </Button>
        {antal === 0 && (
          <span className="text-xs text-muted-foreground">Sæt flueben ved de kunder der skal flyttes.</span>
        )}
      </div>
    </form>
  );
}
