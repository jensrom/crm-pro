import { UnderMenu } from "@/components/layout/UnderMenu";
import { kraevBruger } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const mig = await kraevBruger();
  const punkter = [
    ...(kanLaese(mig.ret.salg) ? [{ href: "/dashboard", label: "Salg" }] : []),
    ...(kanLaese(mig.ret.teknik) ? [{ href: "/dashboard/teknik", label: "Teknik" }] : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      {punkter.length > 1 && <UnderMenu punkter={punkter} />}
      {children}
    </div>
  );
}
