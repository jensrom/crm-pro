import "server-only";
import { db } from "@/lib/db";
import { dokNavn, dokNr, filnavn, hentAfsender } from "@/lib/dokumenter";
import { lavSalgsdokument } from "@/lib/pdf";

/** Bygger tilbuddet/ordrebekræftelsen som PDF ud fra det der er gemt. */
export async function ordrePdf(orderId: string) {
  const o = await db.order.findUnique({
    where: { id: orderId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, company: { select: { accountId: true } } },
  });
  if (!o) return null;

  // Betingelser fra de produkter linjerne hører under — i katalogets rækkefølge
  const pids = [...new Set(o.lines.map((l) => l.productId).filter((x): x is string => !!x))];
  const familier = pids.length
    ? await db.productFamily.findMany({
        where: { products: { some: { id: { in: pids } } } },
        orderBy: { sortOrder: "asc" },
        select: { name: true, commercialTerms: true, generalTerms: true },
      })
    : [];

  const [saelger, kilde] = await Promise.all([
    o.createdBy ? db.user.findUnique({ where: { initials: o.createdBy } }) : null,
    o.sourceOrderId ? db.order.findUnique({ where: { id: o.sourceOrderId }, select: { kind: true, number: true } }) : null,
  ]);

  const bytes = await lavSalgsdokument({
    kind: o.kind,
    afsender: await hentAfsender(o.senderProfileId),
    saelger: {
      navn: saelger?.name ?? o.createdBy ?? null,
      mail: saelger?.email ?? null,
      telefon: saelger?.phone ?? null,
      mobil: saelger?.mobile ?? null,
    },
    nummer: dokNr(o),
    tilbudsnummer: kilde ? dokNr(kilde) : null,
    dato: o.orderDate,
    gyldigTil: o.validUntil,
    reference: o.reference,
    modtager: { navn: o.recipientName, att: o.recipientAttn, adresse: o.recipientAddress, mail: o.recipientEmail },
    intro: o.intro,
    linjer: o.lines.map((l) => ({
      beskrivelse: l.description,
      detaljer: l.details,
      antal: l.quantity,
      enhedspris: l.unitPrice,
      maaneder: l.months,
      model: l.licenseModel,
      fra: l.periodStart,
      til: l.periodEnd,
    })),
    note: o.note,
    betingelser: familier,
  });
  return { bytes, navn: filnavn(dokNavn(o.kind).replace("æ", "ae"), dokNr(o), o.recipientName), ordre: o };
}

export function ordreTotal(lines: { quantity: number; unitPrice: number | null; months: number | null }[]) {
  return lines.reduce((s, l) => s + (l.unitPrice == null ? 0 : l.quantity * l.unitPrice * (l.months ?? 1)), 0);
}
