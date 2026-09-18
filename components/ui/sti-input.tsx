"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";
import { FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    crmProNative?: {
      vaelgFil: (opts: {
        mode?: "open" | "save";
        filters?: { name: string; extensions: string[] }[];
        titel?: string;
        standardSti?: string;
      }) => Promise<string | null>;
    };
  }
}

type Filter = { name: string; extensions: string[] };

const FILTRE: Record<"database" | "manifest", Filter[]> = {
  database: [
    { name: "CRM-Pro database", extensions: ["db"] },
    { name: "Alle filer", extensions: ["*"] },
  ],
  manifest: [
    { name: "version.json", extensions: ["json"] },
    { name: "Alle filer", extensions: ["*"] },
  ],
};

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "defaultValue"> & {
  defaultValue?: string;
  /** Hvilke filtre dialogboksen skal foreslå. */
  filterType?: keyof typeof FILTRE;
  /** "open" = vælg en fil der findes i forvejen. "save" = vælg/navngiv en placering — findes ikke nødvendigvis endnu. */
  dialogMode?: "open" | "save";
  dialogTitel?: string;
};

/**
 * Sti-felt med en "Gennemse…"-knap der åbner Windows' egen stifinder via
 * Electron (electron/preload.js + ipcMain.handle("vaelg-fil", ...) i
 * electron/main.js).
 *
 * Knappen vises kun når den native dialog faktisk er tilgængelig — dvs. når
 * programmet kører som Electron-app. Kører man siden i en almindelig
 * browser (fx npm run dev uden Electron-vinduet), er der ingen bro over til
 * hovedprocessen, og feltet falder tilbage til et almindeligt tekstfelt man
 * selv skriver eller indsætter stien i.
 */
export function StiInput({
  defaultValue,
  filterType = "database",
  dialogMode = "open",
  dialogTitel,
  className,
  ...rest
}: Props) {
  const [vaerdi, setVaerdi] = useState(defaultValue ?? "");
  const [harDialog, setHarDialog] = useState(false);

  useEffect(() => {
    setHarDialog(typeof window !== "undefined" && !!window.crmProNative);
  }, []);

  async function gennemse() {
    if (!window.crmProNative) return;
    const valgt = await window.crmProNative.vaelgFil({
      mode: dialogMode,
      filters: [...FILTRE[filterType]],
      titel: dialogTitel,
      standardSti: vaerdi || undefined,
    });
    if (valgt) setVaerdi(valgt);
  }

  return (
    <div className="flex gap-2">
      <Input
        {...rest}
        value={vaerdi}
        onChange={(e) => setVaerdi(e.target.value)}
        className={className ?? "font-mono text-xs"}
      />
      {harDialog && (
        <button
          type="button"
          onClick={gennemse}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg border border-input text-xs font-medium hover:bg-secondary"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Gennemse…
        </button>
      )}
    </div>
  );
}
