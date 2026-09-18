import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StiInput } from "@/components/ui/sti-input";
import { antalBrugere } from "@/lib/auth";
import { databaseSti } from "@/lib/config";
import { opretFoersteAdmin } from "@/app/actions/auth";
import { pegPaaEksisterendeDatabase } from "@/app/actions/database";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  mangler: "Initialer, navn og PIN skal udfyldes.",
  pin: "PIN skal være 4–8 cifre.",
  tom_sti: "Skriv stien til databasefilen.",
  findes_ikke: "Der ligger ingen fil på den sti. Tjek stavemåden, og at du har adgang til drevet.",
};

export default async function OpsaetningSide({
  searchParams,
}: {
  searchParams: Promise<{ fejl?: string; besked?: string }>;
}) {
  const { fejl, besked } = await searchParams;
  if ((await antalBrugere()) > 0) redirect("/login");
  const sti = databaseSti();

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold">Opret den første bruger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Der er ingen brugere endnu. Den første bliver administrator og kan oprette resten.
          </p>
        </div>

        {besked === "peget" && (
          <p className="text-sm flex items-start gap-2 rounded-lg border border-success/40 bg-success/[0.06] px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success" />
            <span>
              Stien er gemt. <b>Luk programmet og start det igen</b> — så åbner det den fælles database, og du kan
              logge ind med de initialer og den PIN du har fået udleveret.
            </span>
          </p>
        )}

        {fejl && FEJL[fejl] && (
          <p className="text-sm text-danger flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/[0.06] px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {FEJL[fejl]}
          </p>
        )}

        <form action={opretFoersteAdmin} className="bg-card border border-border rounded-xl p-5 grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="initials">Initialer</Label>
            <Input id="initials" name="initials" required maxLength={8} placeholder="JPR" className="uppercase tracking-widest" />
          </div>
          <div>
            <Label htmlFor="pin">PIN (4–8 cifre)</Label>
            <Input id="pin" name="pin" type="password" inputMode="numeric" required placeholder="••••" />
          </div>
          <div className="sm:col-span-2"><Label htmlFor="name">Navn</Label><Input id="name" name="name" required placeholder="Jens Plesner Rom" /></div>
          <div className="sm:col-span-2"><Label htmlFor="email">Mail</Label><Input id="email" name="email" type="email" /></div>
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Opret og log ind</Button></div>
        </form>

        <p className="text-xs text-muted-foreground">
          PIN'en gemmes aldrig i klartekst. Kun en hash med eget salt lander i databasen.
        </p>

        <details className="bg-card border border-border rounded-xl p-5">
          <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Findes databasen allerede et andet sted?
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Bruger I en fælles database på et netværksdrev, skal du <b>ikke</b> oprette en bruger her — så laver du
              den i en tom base ved siden af. Peg i stedet programmet på den rigtige fil, og log ind med de initialer
              en administrator har oprettet til dig.
            </p>

            <form action={pegPaaEksisterendeDatabase} className="flex flex-col gap-3">
              <div>
                <Label htmlFor="databasePath">Sti til databasefilen</Label>
                <StiInput
                  id="databasePath"
                  name="databasePath"
                  required
                  dialogMode="open"
                  filterType="database"
                  dialogTitel="Vælg databasefilen (crm-pro.db)"
                  placeholder="\\\\server\\faelles\\CRM-Pro\\crm-pro.db"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Hele stien inklusive filnavn. Filen skal findes i forvejen — der bliver ikke oprettet noget her.
                </p>
              </div>
              <div className="flex justify-end"><Button type="submit" variant="secondary">Brug den database</Button></div>
            </form>

            <p className="text-xs text-muted-foreground">
              Lige nu leder programmet efter <code className="break-all">{sti}</code>
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
