import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { antalBrugere } from "@/lib/auth";
import { opretFoersteAdmin } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  mangler: "Initialer, navn og PIN skal udfyldes.",
  pin: "PIN skal være 4–8 cifre.",
  kode: "Opsætningskoden passer ikke. Den står i miljøvariablen OPSAETNINGSKODE i Vercel.",
};

export default async function OpsaetningSide({
  searchParams,
}: {
  searchParams: Promise<{ fejl?: string; besked?: string }>;
}) {
  const { fejl, besked } = await searchParams;
  if ((await antalBrugere()) > 0) redirect("/login");
  const kraeverKode = process.env.NODE_ENV === "production";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold">Opret den første bruger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Der er ingen brugere endnu. Den første bliver superadministrator og kan oprette resten.
          </p>
        </div>

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
          {kraeverKode && (
            <div className="sm:col-span-2">
              <Label htmlFor="kode">Opsætningskode</Label>
              <Input id="kode" name="kode" type="password" required />
              <p className="text-xs text-muted-foreground mt-1.5">Værdien af OPSAETNINGSKODE fra projektets miljøvariabler i Vercel.</p>
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end"><Button type="submit">Opret og log ind</Button></div>
        </form>

        <p className="text-xs text-muted-foreground">
          PIN'en gemmes aldrig i klartekst. Kun en hash med eget salt lander i databasen.
        </p>

      </div>
    </div>
  );
}
