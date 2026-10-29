"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { CheckCircle2, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Knap med bekræftelse før en handling, der ikke er en sletning — fx et skift
 * af status, hvor et fejlklik ellers ville flytte ordren. Samme opbygning som
 * BekraeftSlet: "Annullér" har fokus, og handlingen sendes først efter "Ja".
 *
 *   <form action={skiftStatus.bind(null, id, "klar")}>
 *     <BekraeftHandling titel="Skift status til Klar til kunde?" jaTekst="Ja, skift status">…</BekraeftHandling>
 *   </form>
 */
export function BekraeftHandling({
  titel,
  tekst,
  jaTekst = "Ja, fortsæt",
  children,
  className,
  title,
}: {
  titel: string;
  tekst?: React.ReactNode;
  jaTekst?: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const [aaben, setAaben] = useState(false);
  const [sender, setSender] = useState(false);
  const [monteret, setMonteret] = useState(false);
  const udloeser = useRef<HTMLButtonElement>(null);
  const indsend = useRef<HTMLButtonElement>(null);
  const nej = useRef<HTMLButtonElement>(null);
  const titelId = useId();
  const { pending } = useFormStatus();
  const varIGang = useRef(false);

  useEffect(() => setMonteret(true), []);
  useEffect(() => {
    if (pending) varIGang.current = true;
    else if (varIGang.current) {
      varIGang.current = false;
      setSender(false);
      setAaben(false);
    }
  }, [pending]);
  useEffect(() => {
    if (!aaben) return;
    nej.current?.focus();
    const luk = (e: KeyboardEvent) => e.key === "Escape" && !sender && setAaben(false);
    window.addEventListener("keydown", luk);
    const foer = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", luk);
      document.body.style.overflow = foer;
    };
  }, [aaben, sender]);

  function bekraeft() {
    const form = indsend.current?.form;
    if (!form || !indsend.current) return;
    setSender(true);
    form.requestSubmit(indsend.current);
  }

  return (
    <>
      <button ref={udloeser} type="button" onClick={() => setAaben(true)} title={title} className={className}>
        {children}
      </button>
      <button ref={indsend} type="submit" hidden tabIndex={-1} aria-hidden />
      {monteret && aaben &&
        createPortal(
          <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center p-0 sm:p-4" role="presentation">
            <div className="absolute inset-0 bg-[hsl(220_10%_8%/0.45)] animate-in" onClick={() => !sender && setAaben(false)} aria-hidden />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titelId}
              className="relative w-full sm:max-w-md bg-card border border-border shadow-[0_20px_60px_rgba(20,22,26,0.25)] animate-in"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex gap-3.5 px-5 pt-5 pb-4">
                <div className="h-10 w-10 shrink-0 grid place-items-center bg-primary/10 text-primary">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id={titelId} className="text-[15px] font-semibold leading-snug">{titel}</h2>
                  {tekst && <div className="mt-1.5 text-sm text-muted-foreground">{tekst}</div>}
                </div>
              </div>
              <div className="flex gap-2 border-t border-border bg-secondary/40 px-5 py-3.5 sm:justify-end">
                <button
                  ref={nej}
                  type="button"
                  disabled={sender}
                  onClick={() => {
                    setAaben(false);
                    udloeser.current?.focus();
                  }}
                  className="flex-1 sm:flex-none h-11 sm:h-9 px-5 text-sm font-medium border border-border bg-card hover:bg-secondary disabled:opacity-50"
                >
                  Annullér
                </button>
                <button
                  type="button"
                  disabled={sender}
                  onClick={bekraeft}
                  className={cn("flex-1 sm:flex-none h-11 sm:h-9 px-5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 disabled:opacity-70")}
                >
                  {sender ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {jaTekst}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
