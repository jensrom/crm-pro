import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { antalBrugere, hentSession } from "@/lib/auth";
import { hentIndstillinger } from "@/lib/analysis";
import { logInd } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  forkert: "Initialer eller PIN passer ikke.",
  mangler: "Udfyld både initialer og PIN.",
};

export default async function LoginSide({ searchParams }: { searchParams: Promise<{ fejl?: string }> }) {
  const { fejl } = await searchParams;
  if (await hentSession()) redirect("/dashboard");
  if ((await antalBrugere()) === 0) redirect("/opsaetning");

  const i = await hentIndstillinger();

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center gap-3">
          {i.brandLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={i.brandLogo} alt="" className="h-10 w-10 rounded-lg object-contain bg-secondary p-1" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center text-primary-foreground text-sm font-bold">
              {(i.brandMarkText ?? "CP").slice(0, 3)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-tight">CRM-Pro</h1>
            <p className="text-xs text-muted-foreground">{i.brandSubtitle ?? "Idus Online · DK & FO"}</p>
          </div>
        </div>

        {fejl && FEJL[fejl] && (
          <p className="text-sm text-danger flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/[0.06] px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {FEJL[fejl]}
          </p>
        )}

        <form action={logInd} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div>
            <Label htmlFor="initials">Initialer</Label>
            <Input
              id="initials"
              name="initials"
              required
              autoFocus
              autoComplete="username"
              maxLength={8}
              placeholder="fx JPR"
              className="uppercase tracking-widest"
            />
          </div>
          <div>
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              required
              autoComplete="current-password"
              placeholder="••••"
            />
          </div>
          <Button type="submit" className="w-full">Log ind</Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          Har du glemt din PIN, kan en administrator nulstille den under Indstillinger.
        </p>
      </div>
    </div>
  );
}
