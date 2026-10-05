import { PrismaClient } from "@prisma/client";
import { laesSessionKiks } from "@/lib/sessionkiks";

/**
 * Modeller der bærer en updatedBy-kolonne. Alt hvad der gemmes herfra bliver
 * stemplet med initialerne på den der sad ved tasterne.
 */
const STEMPLEDE = new Set([
  "Company", "Contact", "Product", "CustomerProduct", "Deal",
  "Activity", "User", "Ticket", "HourBundle", "CustomerNote", "Settings", "ProductFamily",
]);

const SKRIVNINGER = new Set(["create", "createMany", "update", "updateMany", "upsert"]);

/**
 * Hvem sidder der lige nu?
 *
 * Initialerne kommer fra den signerede login-cookie, ikke fra et opslag i
 * databasen. Et opslag her ville betyde en ekstra læsning midt i en skrivning
 * — også inde i en transaktion — og det er den slags der låser sig fast over
 * et netværksdrev. Uden for en forespørgsel (klargøring, seed) er der ingen
 * cookie, og så stempler vi ikke.
 */
async function nuvaerendeInitialer(): Promise<string | null> {
  const kiks = await laesSessionKiks();
  return kiks?.initials ?? null;
}

/** Sætter updatedBy ind i det args-objekt den enkelte operation bruger. */
function stempl(args: any, operation: string, initialer: string) {
  const paa = (data: any) =>
    Array.isArray(data) ? data.map((d) => ({ ...d, updatedBy: initialer })) : { ...data, updatedBy: initialer };

  if (operation === "upsert") {
    return {
      ...args,
      create: paa(args?.create ?? {}),
      update: paa(args?.update ?? {}),
    };
  }
  if (args?.data == null) return args;
  return { ...args, data: paa(args.data) };
}

function lavKlient() {
  const basis = new PrismaClient();

  return basis.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && STEMPLEDE.has(model) && SKRIVNINGER.has(operation)) {
            const initialer = await nuvaerendeInitialer();
            if (initialer) return query(stempl(args, operation, initialer));
          }
          return query(args);
        },
      },
    },
  });
}

type Klient = ReturnType<typeof lavKlient>;

const globalForPrisma = globalThis as unknown as { prisma?: Klient };

/** Forbindelsen kommer fra DATABASE_URL. Én klient pr. serverinstans. */
export const db: Klient = globalForPrisma.prisma ?? lavKlient();

globalForPrisma.prisma = db;
