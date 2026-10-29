import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Backup af alt det, demomiljøet sletter: kunder og alt der hænger på dem,
 * katalog og ordrer. Hentes som én JSON-fil. Filboksens filer er med som
 * base64, så backuppen er komplet. Kun superadministratorer.
 *
 * Svaret streames tabel for tabel, så store filbokse ikke skal ligge i
 * hukommelsen på én gang.
 */
export async function GET() {
  const session = await hentSession();
  if (!session) return new NextResponse("Ikke logget ind", { status: 401 });
  if (!session.ret.indstillinger) return new NextResponse("Kun superadministratorer", { status: 403 });

  const tabeller: [string, () => Promise<unknown[]>][] = [
    ["productFamilies", () => db.productFamily.findMany()],
    ["products", () => db.product.findMany()],
    ["productPrices", () => db.productPrice.findMany()],
    ["companies", () => db.company.findMany()],
    ["contacts", () => db.contact.findMany()],
    ["contracts", () => db.contract.findMany()],
    ["customerProducts", () => db.customerProduct.findMany()],
    ["licenseChanges", () => db.licenseChange.findMany()],
    ["deals", () => db.deal.findMany()],
    ["activities", () => db.activity.findMany()],
    ["tickets", () => db.ticket.findMany()],
    ["ticketComments", () => db.ticketComment.findMany()],
    ["hourBundles", () => db.hourBundle.findMany()],
    ["timeLogs", () => db.timeLog.findMany()],
    ["customerNotes", () => db.customerNote.findMany()],
    ["logEntries", () => db.logEntry.findMany()],
    ["orders", () => db.order.findMany()],
    ["orderLines", () => db.orderLine.findMany()],
  ];

  const enc = new TextEncoder();
  const tekst = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        c.enqueue(enc.encode(`{"crmpro_backup":1,"oprettet":${tekst(new Date())},"af":${tekst(session.initials)}`));
        for (const [navn, hent] of tabeller) {
          c.enqueue(enc.encode(`,${tekst(navn)}:${tekst(await hent())}`));
        }
        // Filboksen til sidst og én fil ad gangen — data som base64
        c.enqueue(enc.encode(`,"attachments":[`));
        const ids = await db.attachment.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } });
        for (const [i, { id }] of ids.entries()) {
          const a = await db.attachment.findUnique({ where: { id } });
          if (!a) continue;
          const { data, ...rest } = a;
          c.enqueue(enc.encode(`${i ? "," : ""}${tekst({ ...rest, data: Buffer.from(data).toString("base64") })}`));
        }
        c.enqueue(enc.encode("]}"));
        c.close();
      } catch (e) {
        c.error(e);
      }
    },
  });

  const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-pro-backup-${stempel}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
