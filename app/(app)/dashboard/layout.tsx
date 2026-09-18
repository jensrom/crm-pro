import { UnderMenu } from "@/components/layout/UnderMenu";

const PUNKTER = [
  { href: "/dashboard", label: "Salg" },
  { href: "/dashboard/teknik", label: "Teknik" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <UnderMenu punkter={PUNKTER} />
      {children}
    </div>
  );
}
