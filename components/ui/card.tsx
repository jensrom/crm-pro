import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  // Off-white kort med hårfin kant og en næsten usynlig skygge.
  return (
    <div className={cn("min-w-0 bg-card border border-border rounded-xl shadow-[0_1px_2px_rgba(20,22,26,0.035)] dark:shadow-none", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border", className)}>
      <div className="min-w-0 flex-1 basis-[13rem]">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{description}</p>}
      </div>
      {action && <div className="shrink-0 max-w-full">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  // Smallere sidemargen på telefonen — men kun når kalderen ikke selv styrer den vandrette polstring.
  const egenPolstring = /(^|\s)(p|px|pl|pr)-/.test(className ?? "");
  return <div className={cn("px-5 py-4", !egenPolstring && "max-sm:px-4", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  highlight,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  highlight?: boolean;
  /** Farvetone til kort der skal skille sig ud, fx vundne salg. */
  tone?: "success";
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl px-3.5 py-3 sm:px-5 sm:py-4 min-w-0",
        highlight && "border-primary/40 bg-primary/[0.04]",
        tone === "success" && "border-success/35 bg-success/[0.07]"
      )}
    >
      <div className={cn("text-[10px] sm:text-xs font-medium uppercase tracking-wide truncate", tone === "success" ? "text-success" : "text-muted-foreground")}>{label}</div>
      <div className={cn("mt-1 font-serif text-xl sm:text-2xl font-semibold tabular truncate", highlight && "text-primary", tone === "success" && "font-bold text-success")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] sm:text-xs leading-snug text-muted-foreground tabular">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon }: { title: string; description?: string; icon?: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {Icon && <Icon className="h-7 w-7 text-muted-foreground/50" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
    </div>
  );
}
