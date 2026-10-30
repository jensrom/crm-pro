import { UnderMenu } from "@/components/layout/UnderMenu";
import { kraevBruger } from "@/lib/auth";
import { kanLaese } from "@/lib/roller";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const mig = await kraevBruger();
  const punkter = [
    ...(kanLaese(mig.ret.salg) ? [{ href: "/dashboard", label: "Salg" }] : []),
  ];
  return (
    <div className="flex flex-col gap-5">
      {punkter.length > 1 && <UnderMenu punkter={punkter} />}
      {children}
    </div>
  );
}
