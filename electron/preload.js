/**
 * Preload — kører i en sandboxed kontekst mellem hovedprocessen og siden.
 *
 * Eksponerer KUN de få ting siden faktisk skal bruge, gennem contextBridge —
 * aldrig hele "electron"- eller "node"-modulet. Lige nu er det bare den
 * native filvælger (se lib/opdatering og "Gennemse…"-knappen i
 * components/ui/sti-input.tsx), som ellers ikke ville kunne nås fra en
 * almindelig webside.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("crmProNative", {
  /**
   * Åbner Windows' egen stifinder.
   *   mode: "open" — vælg en fil der findes i forvejen (standard).
   *   mode: "save" — vælg/navngiv en placering; filen behøver ikke findes endnu.
   * Returnerer den valgte sti, eller null hvis dialogen blev lukket uden valg.
   */
  vaelgFil: (opts) => ipcRenderer.invoke("vaelg-fil", opts),
});
