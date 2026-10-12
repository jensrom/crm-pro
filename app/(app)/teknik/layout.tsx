import { kraevLaes } from "@/lib/auth";

/** Teknikområdet: kræver mindst læseadgang til teknik (se lib/roller.ts). */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await kraevLaes("teknik");
  return <>{children}</>;
}
