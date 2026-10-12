import { kraevLaes } from "@/lib/auth";

/** Salgsområdet: kræver mindst læseadgang til salg (se lib/roller.ts). */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await kraevLaes("salg");
  return <>{children}</>;
}
