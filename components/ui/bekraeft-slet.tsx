"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMaaSlette, type SletNiveau } from "@/components/ui/slet-ret";

/**
 * Slet-knap med sikkerhedsspørgsmål. Gælder for alle roller: intet slettes
 * uden at man har set, hvad der slettes, og trykket "Ja, slet" en gang til.
 *
 * Bruges i stedet for en almindelig submit-knap inde i en <form>:
 *
 *   <form action={sletFil.bind(null, f.id)}>
 *     <BekraeftSlet hvad={`filen "${f.filename}"`} />
 *   </form>
 *
 * Har knappen sin egen server-handling (formAction), gives den med som prop.
 *
 * Kun Administrator og Superadministrator ser knappen (kraever="superadmin":
 * kun Superadministrator). Andre brugere får slet ingen knap.
 */
export function BekraeftSlet({
  hvad,
  detalje,
  formAction,
  children,
  className,
  ikonKlasse = "h-3.5 w-3.5",
  title,
  kraever = "admin",
}: {
  /** Hvem der må slette: "admin" (Administrator og Superadministrator) eller "superadmin". */
  kraever?: SletNiveau;
  /** Hvad der slettes, fx `filen "Kontrakt.pdf"` — indgår i spørgsmålet. */
  hvad: string;
  /** Valgfri ekstra linje, fx hvad sletningen også rammer. */
  detalje?: string;
  /** Server-handling, hvis knappen ikke bruger formularens egen action. */
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Knappens indhold. Udelades = et skraldespandsikon. */
  children?: React.ReactNode;
  className?: string;
  ikonKlasse?: string;
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

  const maa = useMaaSlette(kraever);

  useEffect(() => setMonteret(true), []);

  // Når sletningen er færdig (og elementet stadig står der, fx ved en fejl),
  // lukkes dialogen igen i stedet for at snurre for evigt.
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
    nej.current?.focus(); // "Nej" er det sikre valg og har fokus
    const luk = (e: KeyboardEvent) => e.key === "Escape" && !sender && setAaben(false);
    window.addEventListener("keydown", luk);
    const foer = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", luk);
      document.body.style.overflow = foer;
    };
  }, [aaben, sender]);

  if (!maa) return null;

  function bekraeft() {
    const form = indsend.current?.form;
    if (!form || !indsend.current) return;
    setSender(true);
    form.requestSubmit(indsend.current);
  }

  return (
    <>
      <button
        ref={udloeser}
        type="button"
        onClick={() => setAaben(true)}
        aria-label={`Slet ${hvad}`}
        title={title ?? `Slet ${hvad}`}
        className={cn(
          children ? "" : "text-muted-foreground hover:text-danger p-1.5 rounded",
          className
        )}
      >
        {children ?? <Trash2 className={ikonKlasse} />}
      </button>
      {/* Den egentlige indsendelse — usynlig, udløses først efter "Ja, slet". */}
      <button ref={indsend} type="submit" formAction={formAction} hidden tabIndex={-1} aria-hidden />

      {monteret && aaben &&
        createPortal(
          <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center p-0 sm:p-4" role="presentation">
            <div
              className="absolute inset-0 bg-[hsl(220_10%_8%/0.45)] animate-in"
              onClick={() => !sender && setAaben(false)}
              aria-hidden
            />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titelId}
              className="relative w-full sm:max-w-md bg-card border border-border shadow-[0_20px_60px_rgba(20,22,26,0.25)] animate-in"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex gap-3.5 px-5 pt-5 pb-4">
                <div className="h-10 w-10 shrink-0 grid place-items-center bg-danger/10 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id={titelId} className="text-[15px] font-semibold leading-snug">
                    Du er ved at slette {hvad}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Er du sikker på, at du vil slette? Det kan ikke fortrydes.
                  </p>
                  {detalje && <p className="mt-2 text-xs text-muted-foreground">{detalje}</p>}
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
                  Nej, behold
                </button>
                <button
                  type="button"
                  disabled={sender}
                  onClick={bekraeft}
                  className="flex-1 sm:flex-none h-11 sm:h-9 px-5 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {sender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Ja, slet
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
