// Seeder CRM-Pro med de 43 danske og færøske Idus Online-kunder.
//
// Hvad scriptet gør, og lige så vigtigt: hvad det IKKE gør.
//   Det opretter kunder, kontaktpersoner, de tre pakker og kundernes
//   nuværende licensantal fra portalen.
//   Det opretter INGEN salgsmuligheder, sætter INGEN prioritet og gætter
//   INGEN pakke. Scope og prioritering er dine beslutninger, ikke scriptets.
//
// Kan køres igen — den opdaterer eksisterende i stedet for at lave dubletter,
// og rører aldrig felter du selv har udfyldt (noter, prioritet, pakkevalg).
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const prisma = new PrismaClient();
const here = dirname(fileURLToPath(import.meta.url));
const kunder = JSON.parse(readFileSync(join(here, '..', 'data', 'kunder.json'), 'utf8'));

const KONF = { 'Høj': 'hoej', 'Middel': 'middel', 'Lav': 'lav' };

const PAKKER = [
  { id: 'idus-ukendt', name: 'Ikke angivet', tier: 'ukendt', pris: null,  sortOrder: 0,
    icon: 'box', color: 'graa',
    beskrivelse: 'Midlertidig placering. Sæt den rigtige pakke på kunden, så regner budgettet med.' },
  { id: 'idus-small',  name: 'Small',  tier: 'small',  pris: 330, sortOrder: 1,
    icon: 'shield', color: 'bronze',
    beskrivelse: 'Idus Online Small. 330 kr. pr. bruger pr. måned.' },
  { id: 'idus-medium', name: 'Medium', tier: 'medium', pris: 550, sortOrder: 2,
    icon: 'award', color: 'soelv',
    beskrivelse: 'Idus Online Medium. 550 kr. pr. bruger pr. måned.' },
  { id: 'idus-large',  name: 'Large',  tier: 'large',  pris: 695, sortOrder: 3,
    icon: 'crown', color: 'guld',
    beskrivelse: 'Idus Online Large. 695 kr. pr. bruger pr. måned.' },
];

function splitName(full) {
  if (!full) return null;
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) };
}

async function main() {
  console.log('Seeder CRM-Pro …');

  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      dataSourceNote:
        'Licenser og stamdata: Idus Online partnerportal, status Paid, 26. august 2026. ' +
        'Antal ansatte og omsætning: CVR via proff.dk, estatistik.dk og ownr.dk samt årsrapporter. ' +
        'Størrelsestallene er baggrundsviden om virksomheden og indgår ikke i budget eller scope.',
    },
  });

  for (const p of PAKKER) {
    await prisma.product.upsert({
      where: { id: p.id },
      // Navn, pris og beskrivelse er dine at rette i appen — scriptet overskriver dem ikke
      // efter første oprettelse. Kun sorteringen holdes på plads.
      update: { sortOrder: p.sortOrder },
      create: {
        id: p.id,
        name: p.name,
        description: p.beskrivelse,
        sku: p.id.toUpperCase(),
        type: 'saas',
        tier: p.tier,
        sortOrder: p.sortOrder,
        icon: p.icon,
        color: p.color,
        pricePerUserMonth: p.pris,
      },
    });
  }
  console.log(`  ${PAKKER.length} pakker på plads`);

  let nye = 0, opdaterede = 0, kontakter = 0, linjer = 0;

  for (const k of kunder) {
    // Kun felter der kommer fra portalen eller researchen. Dine egne felter
    // (priority, notes) skrives aldrig af scriptet.
    const felter = {
      name: k.name,
      industry: k.industry,
      address: k.address,
      country: k.country,
      portalCountry: k.portalCountry,
      subdomain: k.subdomain,
      runningStatus: k.runningStatus,
      code: k.code,
      groupCode: k.groupCode,
      currencyCode: k.currencyCode,
      email: k.email,
      phone: k.phone,
      website: k.subdomain ? `https://${k.subdomain}.idusonline.com` : null,
      employees: k.employees,
      revenueMdkk: k.revenueMdkk,
      sizeConfidence: KONF[k.sizeConfidence] ?? null,
      sizeNote: k.sizeNote,
      sourceUrl: k.sourceUrl,
    };

    const eksisterende = await prisma.company.findUnique({ where: { accountId: k.accountId } });
    const company = eksisterende
      ? (opdaterede++, await prisma.company.update({ where: { id: eksisterende.id }, data: felter }))
      : (nye++, await prisma.company.create({ data: { accountId: k.accountId, ...felter } }));

    // Licenslinje. Findes den, opdateres kun antallet — pakkevalg og aftalt
    // pris er dine og bliver stående.
    const linje = await prisma.customerProduct.findFirst({ where: { companyId: company.id } });
    if (linje) {
      await prisma.customerProduct.update({
        where: { id: linje.id },
        data: { seats: k.seats, activeSeats: k.activeSeats },
      });
    } else {
      await prisma.customerProduct.create({
        data: {
          companyId: company.id,
          productId: 'idus-ukendt',
          seats: k.seats,
          activeSeats: k.activeSeats,
          billingInterval: 'annual',
        },
      });
      linjer++;
    }

    const navn = splitName(k.contactName);
    if (navn) {
      const findes = await prisma.contact.findFirst({
        where: { companyId: company.id, firstName: navn.firstName, lastName: navn.lastName },
      });
      if (!findes) {
        await prisma.contact.create({
          data: { ...navn, companyId: company.id, email: k.email, phone: k.phone, isPrimary: true },
        });
        kontakter++;
      }
    }
  }

  const udenPakke = await prisma.customerProduct.count({ where: { productId: 'idus-ukendt' } });

  console.log(`  ${nye} nye kunder, ${opdaterede} opdaterede`);
  console.log(`  ${kontakter} kontaktpersoner, ${linjer} licenslinjer oprettet`);
  console.log(`  ${udenPakke} kunder mangler pakkevalg — sæt dem under Produkter`);
  await katalogOgRoller();
  console.log('Færdig. Ingen salgsmuligheder oprettet — dem opretter du selv.');
}

/**
 * Samme klargøring som den pakkede app laver ved opstart (electron/bootstrap.mjs):
 * licenser uden produkt lægges under "Idus", prishistorikken startes, og der
 * sikres mindst én superadministrator.
 */
async function katalogOgRoller() {
  if ((await prisma.productFamily.count()) === 0) {
    await prisma.productFamily.create({ data: { id: 'fam-idus', name: 'Idus', description: 'Idus Online', sortOrder: 1 } });
  }
  const foerste = await prisma.productFamily.findFirst({ orderBy: { sortOrder: 'asc' } });
  const flyttet = await prisma.product.updateMany({ where: { familyId: null }, data: { familyId: foerste.id } });
  if (flyttet.count) console.log(`  ${flyttet.count} licenser lagt under "${foerste.name}" i kataloget`);

  const udenHistorik = await prisma.product.findMany({ where: { prices: { none: {} } } });
  for (const p of udenHistorik) {
    await prisma.productPrice.create({
      data: {
        productId: p.id,
        price: p.licenseModel === 'perpetual' ? p.oneTimePrice : p.pricePerUserMonth,
        validFrom: p.createdAt,
        appliedAt: new Date(),
        note: 'Pris da kataloget blev oprettet',
      },
    });
  }

  const superadmins = await prisma.user.count({ where: { role: 'superadmin', isActive: true } });
  if (superadmins === 0) {
    const aeldste = await prisma.user.findFirst({ where: { role: 'admin', isActive: true }, orderBy: { createdAt: 'asc' } });
    if (aeldste) {
      await prisma.user.update({ where: { id: aeldste.id }, data: { role: 'superadmin' } });
      console.log(`  ${aeldste.initials} er gjort til superadministrator`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
