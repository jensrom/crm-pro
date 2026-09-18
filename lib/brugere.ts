import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Initialer → navn. Slås op én gang pr. sidevisning, uanset hvor mange
 * "sidst gemt af" der står på siden.
 */
export const navneOpslag = cache(async (): Promise<Map<string, string>> => {
  const brugere = await db.user.findMany({ select: { initials: true, name: true } });
  return new Map<string, string>(
    (brugere as { initials: string; name: string }[]).map((b) => [b.initials, b.name])
  );
});

/** Navnet bag initialerne. Er brugeren slettet, står initialerne tilbage. */
export async function navnFor(initialer: string | null | undefined) {
  if (!initialer) return null;
  return (await navneOpslag()).get(initialer) ?? initialer;
}
