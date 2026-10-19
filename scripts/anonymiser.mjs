/**
 * Kører anonymiseringen (scripts/anonymisering.mjs) mod databasen.
 * Kaldes automatisk i vercel-build, så hver udrulning rydder op. Fejler aldrig
 * builden — en fejl her logges bare.
 *
 *   node --env-file=.env scripts/anonymiser.mjs
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { anonymiserDatabase } from "./anonymisering.mjs";

const prisma = new PrismaClient();
try {
  await anonymiserDatabase(prisma, Prisma);
} catch (e) {
  console.warn("  anonymisering sprunget over:", e?.message ?? e);
} finally {
  await prisma.$disconnect();
}
