"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function UnderMenu({ punkter }: { punkter: { href: string; label: string }[] }) {
  const sti = usePathname();

  return (
    <nav className="fanerække flex items-center gap-1 border-b border-border -mt-1 -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Undermenu">
      {punkter.map((p) => {
        const aktiv = sti === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={aktiv ? "page" : undefined}
            className={cn(
              "px-3 py-2.5 sm:py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
              aktiv
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
