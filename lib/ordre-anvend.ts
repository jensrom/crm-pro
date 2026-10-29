import "server-only";
import { db } from "@/lib/db";
import { dokNr, subNr } from "@/lib/dokumenter";
import { registrerLicensaendring } from "@/lib/licenser";
import { dagTekst } from "@/lib/perioder";
import { kontraktTerm } from "@/lib/kontrakter";

/**
 * Lægger en ordrebekræftelse over på kundens aftaler:
 *   • fornyelser → aftalens udløb flyttes til linjens slutdato (og antal rettes, hvis det er ændret)
 *   • nye licenser → registreres som tilkøb; findes licensen ikke på kunden, oprettes linjen
 *     med ordrelinjens periode
 *   • tilkøb på en SUB-nøgle → antallet lægges på nøglens linje med licensen; har nøglen ikke
 *     licensen, oprettes linjen under nøglen med nøglens udløb
 *   • opgradering → linjen skifter til den nye pakke (samme nøgle og udløb), prisen bliver
 *     nuværende pris + merprisen, og antallet rettes, hvis det er ændret
 * Frie linjer rører ikke kunden. Kan kun ske én gang pr. ordre.
 */
export async function anvendOrdrePaaKunde(orderId: string, initials: string | null) {
  const o = await db.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!o || !o.companyId || o.kind !== "ordre" || o.appliedAt) return 0;
  const companyId = o.companyId;
  const nr = dokNr(o);
  let antal = 0;
  const kontrakt = o.contractId
    ? await db.contract.findUnique({ where: { id: o.contractId }, include: { lines: { include: { product: true } } } })
    : null;
  const sub = kontrakt ? subNr(kontrakt.subNumber) : null;

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
      } else if (l.lineKind === "tilkoeb" && l.productId && l.licenseModel !== "fee") {
        const produkt = await tx.product.findUnique({ where: { id: l.productId } });
        const afvigerFraListe = l.unitPrice != null && produkt && l.licenseModel === "sub" && l.unitPrice !== produkt.pricePerUserMonth;
        await registrerLicensaendring(tx, {
          companyId,
          productId: l.productId,
          delta: l.quantity,
          unitPrice: l.unitPrice,
          date: l.periodStart ?? o.orderDate,
          note: sub ? `${nr} · tilkøb på ${sub}` : nr,
          initials,
          linjeId: l.customerProductId,
          contractId: kontrakt?.id ?? null,
          ny: {
            startDate: l.periodStart ?? o.orderDate,
            endDate: l.periodEnd,
            termMonths: kontrakt ? kontraktTerm(kontrakt.lines) : 12,
            unitPriceMonth: afvigerFraListe ? l.unitPrice : null,
          },
        });
        antal++;
      } else if (l.lineKind === "opgradering" && l.customerProductId && l.productId) {
        // Linjen skifter pakke: samme nøgle og periode, ny licens og pris; antal rettes, hvis det er ændret
        const cp = await tx.customerProduct.findUnique({ where: { id: l.customerProductId }, include: { product: true } });
        const til = await tx.product.findUnique({ where: { id: l.productId } });
        if (!cp || !til) continue;
        const nuPris = cp.unitPriceMonth ?? cp.product.pricePerUserMonth ?? 0;
        const nyPris = nuPris + (l.unitPrice ?? 0);
        await tx.customerProduct.update({
          where: { id: cp.id },
          data: { productId: til.id, unitPriceMonth: til.pricePerUserMonth != null && nyPris === til.pricePerUserMonth ? null : nyPris },
        });
        if (l.quantity !== cp.seats) {
          await registrerLicensaendring(tx, {
            companyId,
            productId: til.id,
            delta: l.quantity - cp.seats,
            unitPrice: nyPris,
            date: l.periodStart ?? o.orderDate,
            note: `Opgradering ${nr}`,
            initials,
            linjeId: cp.id,
          });
        }
        await tx.logEntry.create({
          data: {
            companyId,
            kind: "aftale",
            content: `Opgraderet: ${cp.product.name} → ${til.name}, ${l.quantity} licenser til ${nyPris} kr. pr. bruger/md. (${nr})`,
            author: initials,
          },
        });
        antal++;
      } else if (l.lineKind === "nyt" && l.productId && l.licenseModel !== "fee") {
        await registrerLicensaendring(tx, {
          companyId,
          productId: l.productId,
          delta: l.quantity,
          unitPrice: l.unitPrice,
          date: l.periodStart ?? o.orderDate,
          note: nr,
          initials,
          contractId: kontrakt?.id ?? null,
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
