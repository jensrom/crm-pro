import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { hentIndstillinger } from "@/lib/analysis";
import { kraevBruger } from "@/lib/auth";
import { db } from "@/lib/db";
import { anvendPlanlagtePriser } from "@/lib/katalog";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Prisændringer med en dato der nu er nået, lægges over på licenserne.
  try {
    await anvendPlanlagtePriser();
  } catch {
    /* må aldrig vælte layoutet */
  }

  const [bruger, i, hotAntal] = await Promise.all([
    kraevBruger(),
    hentIndstillinger(),
    db.company.count({ where: { isActive: true, isHot: true } as any }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar
        brand={{ subtitle: i.brandSubtitle, markText: i.brandMarkText, logo: i.brandLogo }}
        hotAntal={hotAntal}
        visIndstillinger={bruger.erSuperAdmin}
      />
      <div className="lg:pl-[var(--sidebar-width)]">
        <AppTopbar bruger={bruger} />
        <main className="p-5 lg:p-7 animate-in">{children}</main>
      </div>
    </div>
  );
}
