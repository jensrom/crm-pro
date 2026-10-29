/**
 * Klargøring af databasen efter seed eller flytning. Kan køres flere gange —
 * den laver kun det, der mangler:
 *   1. Produktet "Idus" i kataloget (med Idus' betingelser), hvis kataloget er tomt
 *   2. Licenser uden produkt lægges under det første produkt
 *   3. Prishistorik startes for licenser, der ikke har nogen
 *   4. Licenslinjer uden SUB-nøgle (kontrakt) får hver sin — et gammelt SUB-nummer genbruges
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
        price: p.licenseModel === "perpetual" || p.licenseModel === "fee" ? p.oneTimePrice : p.pricePerUserMonth,
        validFrom: p.createdAt,
        appliedAt: new Date(),
        note: "Pris da kataloget blev oprettet",
      },
    });
  }
  if (udenHistorik.length) log(`  prishistorik startet for ${udenHistorik.length} licenser`);

  // SUB-nøgler: hver linje uden nøgle får sin egen kontrakt. Et gammelt SUB-nummer på linjen genbruges som nøgle.
  const udenNoegle = await prisma.customerProduct.findMany({
    where: { contractId: null },
    orderBy: [{ subNumber: "asc" }, { createdAt: "asc" }],
    select: { id: true, companyId: true, subNumber: true },
  });
  if (udenNoegle.length) {
    const [c, l] = await Promise.all([
      prisma.contract.aggregate({ _max: { subNumber: true } }),
      prisma.customerProduct.aggregate({ _max: { subNumber: true } }),
    ]);
    let n = Math.max(c._max.subNumber ?? 0, l._max.subNumber ?? 0);
    const brugt = new Set((await prisma.contract.findMany({ select: { subNumber: true } })).map((k) => k.subNumber));
    for (const x of udenNoegle) {
      const nr = x.subNumber != null && !brugt.has(x.subNumber) ? x.subNumber : ++n;
      brugt.add(nr);
      const k = await prisma.contract.create({ data: { companyId: x.companyId, subNumber: nr } });
      await prisma.customerProduct.update({ where: { id: x.id }, data: { contractId: k.id } });
    }
    log(`  ${udenNoegle.length} licenslinjer fik en SUB-nøgle`);
  }

  if ((await prisma.user.count({ where: { role: "superadmin", isActive: true } })) === 0) {
    const aeldste = await prisma.user.findFirst({ where: { role: "admin", isActive: true }, orderBy: { createdAt: "asc" } });
    if (aeldste) {
      await prisma.user.update({ where: { id: aeldste.id }, data: { role: "superadmin" } });
      log(`  ${aeldste.initials} er gjort til superadministrator`);
    }
  }
}
