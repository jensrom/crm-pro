import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { MobilNav } from "@/components/layout/MobilNav";
import { RulTilAktiv } from "@/components/ui/rul-til-aktiv";
import { hentIndstillinger } from "@/lib/analysis";
import { kraevBruger } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";
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
        visIndstillinger={bruger.ret.indstillinger}
        omraader={{ salg: kanLaese(bruger.ret.salg), teknik: kanLaese(bruger.ret.teknik) }}
      />
      <div className="lg:pl-[var(--sidebar-width)]">
        <AppTopbar bruger={bruger} maerke={{ logo: i.brandLogo, tekst: i.brandMarkText }} />
        <main className="px-4 pt-4 pb-[calc(84px+env(safe-area-inset-bottom))] sm:px-5 sm:pt-5 lg:p-7 animate-in">{children}</main>
      </div>
      <RulTilAktiv />
      <MobilNav
        brand={{ subtitle: i.brandSubtitle, markText: i.brandMarkText, logo: i.brandLogo }}
        hotAntal={hotAntal}
        visIndstillinger={bruger.ret.indstillinger}
        omraader={{ salg: kanLaese(bruger.ret.salg), teknik: kanLaese(bruger.ret.teknik) }}
        bruger={bruger}
      />
    </div>
  );
}
