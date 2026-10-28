"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function UnderMenu({ punkter }: { punkter: { href: string; label: string }[] }) {
  const sti = usePathname();

  return (
    <nav className="fanerække spor self-start" aria-label="Undermenu">
      {punkter.map((p) => {
        const aktiv = sti === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={aktiv ? "page" : undefined}
            className="pille"
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
