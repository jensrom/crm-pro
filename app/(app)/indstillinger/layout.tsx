import { UnderMenu } from "@/components/layout/UnderMenu";
import { kraevSuperAdmin } from "@/lib/auth";

const PUNKTER = [
  { href: "/indstillinger", label: "Generelt" },
  { href: "/indstillinger/brugere", label: "Brugere" },
  { href: "/indstillinger/whitelabel", label: "Whitelabel" },
  { href: "/indstillinger/katalog", label: "Katalog" },
  { href: "/indstillinger/dokumenter", label: "Dokumenter" },
  { href: "/indstillinger/eksport", label: "Eksport" },
];

export default async function IndstillingerLayout({ children }: { children: React.ReactNode }) {
  // Hele Indstillinger er forbeholdt superadministratorer.
  await kraevSuperAdmin();

  return (
    <div className="flex flex-col gap-5">
      <UnderMenu punkter={PUNKTER} />
      {children}
    </div>
  );
}
