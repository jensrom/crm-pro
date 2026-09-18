// Engangsoprydning efter omlægningen til licensbaseret budget.
//
// Fjerner det som modellen havde bestemt på dine vegne:
//   • salgsmuligheder som seed-scriptet selv oprettede ud fra et beregnet potentiale
//   • prioriteter der var udledt af samme beregning
//
// Sager du selv har oprettet røres ikke — kun dem der bærer seed-scriptets
// egen signatur i titel og note. Scriptet kan køres flere gange.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const auto = await prisma.deal.findMany({
    where: {
      AND: [
        { title: { startsWith: 'Udvidelse: +' } },
        { notes: { contains: 'Modelleret mod benchmark' } },
      ],
    },
    select: { id: true, title: true, company: { select: { name: true } } },
  });

  if (auto.length) {
    await prisma.deal.deleteMany({ where: { id: { in: auto.map((d) => d.id) } } });
    console.log(`  ${auto.length} modelgenererede salgsmuligheder slettet`);
  } else {
    console.log('  ingen modelgenererede salgsmuligheder at slette');
  }

  const ryddet = await prisma.company.updateMany({
    where: { priority: { not: null } },
    data: { priority: null },
  });
  console.log(`  prioritet ryddet på ${ryddet.count} kunder — feltet er dit nu`);

  // Giver de fire oprindelige pakker deres mærke, men kun hvis de stadig
  // står på standarden — har du selv valgt ikon eller farve, bliver det stående.
  const MAERKER = [
    { id: 'idus-ukendt', icon: 'box',    color: 'graa'   },
    { id: 'idus-small',  icon: 'shield', color: 'bronze' },
    { id: 'idus-medium', icon: 'award',  color: 'soelv'  },
    { id: 'idus-large',  icon: 'crown',  color: 'guld'   },
  ];
  let maerket = 0;
  for (const m of MAERKER) {
    const p = await prisma.product.findUnique({ where: { id: m.id } });
    if (!p) continue;
    const uroert = (p.icon == null || p.icon === 'package') && (p.color == null || p.color === 'graa');
    if (uroert) {
      await prisma.product.update({ where: { id: m.id }, data: { icon: m.icon, color: m.color } });
      maerket++;
    }
  }
  console.log(`  ${maerket} pakker fik deres mærke (guld, sølv, bronze)`);

  const tilbage = await prisma.deal.count();
  console.log(`  ${tilbage} salgsmuligheder tilbage i basen`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
