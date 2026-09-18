import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function IngenAdgang() {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="text-center max-w-sm flex flex-col items-center gap-3">
        <ShieldOff className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Kun for administratorer</h1>
        <p className="text-sm text-muted-foreground">
          Indstillinger kan kun åbnes af en bruger med administratorrettigheder. Har du brug for adgang,
          skal en administrator ændre din rolle.
        </p>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">Til dashboard</Link>
      </div>
    </div>
  );
}
