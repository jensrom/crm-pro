import "server-only";
import { db } from "@/lib/db";
import { dokNr } from "@/lib/dokumenter";
import { registrerLicensaendring } from "@/lib/licenser";
import { dagTekst } from "@/lib/perioder";

/**
 * Lægger en ordrebekræftelse over på kundens aftaler:
 *   • fornyelser → aftalens udløb flyttes til linjens slutdato (og antal rettes, hvis det er ændret)
 *   • nye licenser → registreres som tilkøb; findes licensen ikke på kunden, oprettes linjen
 *     med ordrelinjens periode
 * Frie linjer rører ikke kunden. Kan kun ske én gang pr. ordre.
 */
export async function anvendOrdrePaaKunde(orderId: string, initials: string | null) {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!o || !o.companyId || o.kind !== "ordre" || o.appliedAt) return 0;
  const companyId = o.companyId;
  const nr = dokNr(o);
  let antal = 0;

  await db.$transaction(async (tx) => {
    for (const l of o.lines) {
      if (l.lineKind === "fornyelse" && l.customerProductId) {
        const cp = await tx.customerProduct.findUnique({ where: { id: l.customerProductId }, include: { product: true } });
        if (!cp) continue;
        await tx.customerProduct.update({
          where: { id: cp.id },
          data: { ...(l.periodEnd ? { endDate: l.periodEnd } : {}) },
        });
        if (l.quantity !== cp.seats) {
          await registrerLicensaendring(tx, {
            companyId,
            productId: cp.productId,
            delta: l.quantity - cp.seats,
            unitPrice: l.unitPrice,
            date: l.periodStart ?? o.orderDate,
            note: `Fornyelse ${nr}`,
            initials,
          });
        }
        await tx.logEntry.create({
          data: {
            companyId,
            kind: "aftale",
            content: `Fornyet: ${cp.product.name}, ${l.quantity} licenser til ${dagTekst(l.periodEnd)} (${nr})`,
            author: initials,
          },
        });
        antal++;
      } else if (l.lineKind === "nyt" && l.productId) {
        await registrerLicensaendring(tx, {
          companyId,
          productId: l.productId,
          delta: l.quantity,
          unitPrice: l.unitPrice,
          date: l.periodStart ?? o.orderDate,
          note: nr,
          initials,
          ny: {
            startDate: l.periodStart ?? o.orderDate,
            endDate: l.periodEnd,
            termMonths: l.months && [12, 24, 36].includes(l.months) ? l.months : 12,
          },
        });
        antal++;
      }
    }
    await tx.order.update({ where: { id: o.id }, data: { appliedAt: new Date() } });
  });
  return antal;
}
