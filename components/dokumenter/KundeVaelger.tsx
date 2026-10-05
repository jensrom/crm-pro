"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Label, Select } from "@/components/ui/input";

/**
 * Kundevalg på nyt tilbud/ordre. Skifter siden til ?kunde=<id> med det samme,
 * så modtager, aftaler og aftalte priser udfyldes uden et ekstra klik.
 */
export function KundeVaelger({
  kunder,
  valgt,
  kind,
}: {
  kunder: { id: string; name: string }[];
  valgt: string | null;
  kind: string;
}) {
  const router = useRouter();
  const [venter, start] = useTransition();

  return (
    <div className="w-80 max-w-full">
      <Label htmlFor="kunde">Kunde{venter && <span className="ml-2 text-muted-foreground font-normal">henter …</span>}</Label>
      <Select
        id="kunde"
        name="kunde"
        value={valgt ?? ""}
        disabled={venter}
        onChange={(e) => {
          const id = e.target.value;
          start(() => router.push(`/ordrer/ny?type=${kind}${id ? `&kunde=${id}` : ""}`));
        }}
      >
        <option value="">Ingen kunde — fri modtager</option>
        {kunder.map((k) => (
          <option key={k.id} value={k.id}>{k.name}</option>
        ))}
      </Select>
    </div>
  );
}
