#!/usr/bin/env node
/** npm run db:klargoer — kører klargøringen (se scripts/klargoering.mjs) mod databasen i .env. */
import { PrismaClient } from "@prisma/client";
import { klargoer } from "./klargoering.mjs";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL } },
});
try {
  console.log("Klargør databasen …");
  await klargoer(prisma);
  console.log("Færdig.");
} finally {
  await prisma.$disconnect();
}
