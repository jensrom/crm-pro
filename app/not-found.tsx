import Link from "next/link";

export default function IkkeFundet() {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="text-center max-w-sm">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-1 text-xl font-semibold">Siden findes ikke</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Linket peger på noget der ikke er her. Gå tilbage til dashboardet.
        </p>
        <Link href="/dashboard" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
          Til dashboard
        </Link>
      </div>
    </div>
  );
}
