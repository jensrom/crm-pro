import "server-only";
import { db } from "@/lib/db";
import { filnavn, hentAfsender, ordreNr } from "@/lib/dokumenter";
import { lavOrdrebekraeftelse } from "@/lib/pdf";
import { navnFor } from "@/lib/brugere";

/** Bygger ordrebekræftelsen som PDF ud fra det der er gemt på ordren. */
export async function ordrePdf(orderId: string) {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, company: { select: { accountId: true } } },
  });
  if (!o) return null;
  const bytes = await lavOrdrebekraeftelse({
    afsender: await hentAfsender(),
    nummer: ordreNr(o.number),
    dato: o.orderDate,
    reference: o.reference,
    konto: o.company?.accountId ?? null,
    modtager: { navn: o.recipientName, att: o.recipientAttn, adresse: o.recipientAddress, mail: o.recipientEmail },
    linjer: o.lines.map((l) => ({
      beskrivelse: l.description,
      antal: l.quantity,
      enhedspris: l.unitPrice,
      maaneder: l.months,
      model: l.licenseModel,
    })),
    moms: o.vatRate,
    note: o.note,
    udstedtAf: await navnFor(o.createdBy),
  });
  return { bytes, navn: filnavn("Ordrebekraeftelse", ordreNr(o.number), o.recipientName), ordre: o };
}

export function ordreTotal(lines: { quantity: number; unitPrice: number | null; months: number | null }[]) {
  return lines.reduce((s, l) => s + (l.unitPrice == null ? 0 : l.quantity * l.unitPrice * (l.months ?? 1)), 0);
}
