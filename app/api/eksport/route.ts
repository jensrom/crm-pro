import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Hele databasen som én JSON-fil — til en kopi i hånden. Kun superadministrator.
 * ?filer=1 tager også filboksens indhold med (base64), ellers kun oplysningerne om filerne.
 */
export async function GET(req: Request) {
  const s = await hentSession();
  if (!s?.erSuperAdmin) return new NextResponse("Kun superadministrator", { status: 403 });
  const medFiler = new URL(req.url).searchParams.get("filer") === "1";

  const [
    settings, users, productFamilies, products, productPrices, companies, contacts, customerProducts,
    licenseChanges, deals, activities, tickets, ticketComments, hourBundles, timeLogs, customerNotes,
    logEntries, orders, orderLines, attachments,
  ] = await Promise.all([
    db.settings.findMany(),
    db.user.findMany({ omit: { pinHash: true } }),
    db.productFamily.findMany(),
    db.product.findMany(),
    db.productPrice.findMany(),
    db.company.findMany(),
    db.contact.findMany(),
    db.customerProduct.findMany(),
    db.licenseChange.findMany(),
    db.deal.findMany(),
    db.activity.findMany(),
    db.ticket.findMany(),
    db.ticketComment.findMany(),
    db.hourBundle.findMany(),
    db.timeLog.findMany(),
    db.customerNote.findMany(),
    db.logEntry.findMany(),
    db.order.findMany(),
    db.orderLine.findMany(),
    medFiler ? db.attachment.findMany() : db.attachment.findMany({ omit: { data: true } }),
  ]);

  const data = {
    eksporteret: new Date().toISOString(),
    af: s.initials,
    tabeller: {
      settings, users, productFamilies, products, productPrices, companies, contacts, customerProducts,
      licenseChanges, deals, activities, tickets, ticketComments, hourBundles, timeLogs, customerNotes,
      logEntries, orders, orderLines,
      attachments: attachments.map((a) => {
        const d = (a as { data?: Uint8Array }).data;
        return d ? { ...a, data: Buffer.from(d).toString("base64") } : a;
      }),
    },
  };
  const dato = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-pro-eksport-${dato}${medFiler ? "-med-filer" : ""}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
