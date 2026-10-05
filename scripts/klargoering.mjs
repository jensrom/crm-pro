/**
 * Klargøring af databasen efter seed eller flytning. Kan køres flere gange —
 * den laver kun det, der mangler:
 *   1. Produktet "Idus" i kataloget (med Idus' betingelser), hvis kataloget er tomt
 *   2. Licenser uden produkt lægges under det første produkt
 *   3. Prishistorik startes for licenser, der ikke har nogen
 *   4. Licenslinjer uden SUB-nummer får det næste ledige
 *   5. Er der ingen aktiv superadministrator, bliver den ældste aktive administrator det
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export async function klargoer(prisma, log = console.log) {
  const laes = (f) => {
    const sti = join(process.cwd(), "prisma", "betingelser", f);
    return existsSync(sti) ? readFileSync(sti, "utf8").trim() : null;
  };

  if ((await prisma.productFamily.count()) === 0) {
    await prisma.productFamily.create({ data: { id: "fam-idus", name: "Idus", description: "Idus Online", sortOrder: 1 } });
    log('  produktet "Idus" oprettet i kataloget');
  }
  const idus = await prisma.productFamily.findUnique({ where: { id: "fam-idus" } });
  if (idus && !idus.commercialTerms && !idus.generalTerms) {
    await prisma.productFamily.update({
      where: { id: "fam-idus" },
      data: { commercialTerms: laes("idus-kommercielle.txt"), generalTerms: laes("idus-generelle.txt") },
    });
    log('  betingelser lagt ind på "Idus"');
  }

  const foerste = await prisma.productFamily.findFirst({ orderBy: { sortOrder: "asc" } });
  const flyttet = await prisma.product.updateMany({ where: { familyId: null }, data: { familyId: foerste.id } });
  if (flyttet.count) log(`  ${flyttet.count} licenser lagt under "${foerste.name}"`);

  const udenHistorik = await prisma.product.findMany({ where: { prices: { none: {} } } });
  for (const p of udenHistorik) {
    await prisma.productPrice.create({
      data: {
        productId: p.id,
        price: p.licenseModel === "perpetual" ? p.oneTimePrice : p.pricePerUserMonth,
        validFrom: p.createdAt,
        appliedAt: new Date(),
        note: "Pris da kataloget blev oprettet",
      },
    });
  }
  if (udenHistorik.length) log(`  prishistorik startet for ${udenHistorik.length} licenser`);

  const udenSub = await prisma.customerProduct.findMany({ where: { subNumber: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (udenSub.length) {
    const maks = await prisma.customerProduct.aggregate({ _max: { subNumber: true } });
    let n = maks._max.subNumber ?? 0;
    for (const l of udenSub) await prisma.customerProduct.update({ where: { id: l.id }, data: { subNumber: ++n } });
    log(`  ${udenSub.length} licenslinjer fik SUB-nummer`);
  }

  if ((await prisma.user.count({ where: { role: "superadmin", isActive: true } })) === 0) {
    const aeldste = await prisma.user.findFirst({ where: { role: "admin", isActive: true }, orderBy: { createdAt: "asc" } });
    if (aeldste) {
      await prisma.user.update({ where: { id: aeldste.id }, data: { role: "superadmin" } });
      log(`  ${aeldste.initials} er gjort til superadministrator`);
    }
  }
}
