import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function IngenAdgang() {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="text-center max-w-sm flex flex-col items-center gap-3">
        <ShieldOff className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Kun for superadministratorer</h1>
        <p className="text-sm text-muted-foreground">
          Indstillinger kan kun åbnes af en superadministrator. Har du brug for adgang,
          skal en superadministrator ændre din rolle under Indstillinger → Brugere.
        </p>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">Til dashboard</Link>
      </div>
    </div>
  );
}
