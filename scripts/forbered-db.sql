-- Kører før "prisma db push" i vercel-build. Idempotent: gør intet, hvis det allerede findes.
--
-- Prisma afviser at tilføje et unikt indeks uden --accept-data-loss, også når
-- kolonnen er ny og tom. Det flag vil vi ikke have i buildet permanent, så nye
-- unikke kolonner oprettes her først; bagefter ser db push ingen forskel.

-- Kundenummer (K-00001) og afdeling på kunder
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "customerNumber" INTEGER;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "department" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "companies_customerNumber_key" ON "companies"("customerNumber");
