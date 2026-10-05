import "server-only";
import { db } from "@/lib/db";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Flytter licensantallet på kundens linje for en licens og gemmer posten i
 * tilkøbshistorikken og logbogen. Findes linjen ikke, oprettes den.
 * Bruges både af "Tilkøb og licensændringer" og når en ordre lægges på kunden.
 */
export async function registrerLicensaendring(
  tx: Tx,
  a: {
    companyId: string;
    productId: string;
    delta: number;
    unitPrice?: number | null;
    date?: Date;
    note?: string | null;
    initials: string | null;
    /** Kun ved ny linje */
    ny?: { startDate?: Date | null; endDate?: Date | null; termMonths?: number | null };
    logTekst?: string;
  }
) {
  const produkt = await tx.product.findUnique({ where: { id: a.productId } });
  if (!produkt) throw new Error("Licensen findes ikke");
  const linje = await tx.customerProduct.findFirst({
    where: { companyId: a.companyId, productId: a.productId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const foer = linje?.seats ?? 0;
  const efter = Math.max(0, foer + a.delta);
  const dato = a.date ?? new Date();
  const pris =
    a.unitPrice ??
    (produkt.licenseModel === "perpetual" ? produkt.oneTimePrice : linje?.unitPriceMonth ?? produkt.pricePerUserMonth);

  let linjeId: string;
  if (linje) {
    await tx.customerProduct.update({ where: { id: linje.id }, data: { seats: efter } });
    linjeId = linje.id;
  } else {
    const ny = await tx.customerProduct.create({
      data: {
        companyId: a.companyId,
        productId: a.productId,
        seats: efter,
        activeSeats: 0,
        startDate: a.ny?.startDate ?? dato,
        endDate: a.ny?.endDate ?? null,
        termMonths: a.ny?.termMonths ?? 12,
      },
    });
    linjeId = ny.id;
  }
  if (a.delta !== 0) {
    await tx.licenseChange.create({
      data: {
        companyId: a.companyId,
        productId: a.productId,
        quantity: efter - foer,
        seatsBefore: foer,
        seatsAfter: efter,
        unitPrice: pris,
        licenseModel: produkt.licenseModel,
        date: dato,
        note: a.note ?? null,
        createdBy: a.initials,
      },
    });
  }
  await tx.logEntry.create({
    data: {
      companyId: a.companyId,
      kind: "aftale",
      content:
        a.logTekst ??
        `${a.delta < 0 ? "Reduktion" : "Tilkøb"}: ${a.delta > 0 ? "+" : ""}${a.delta} × ${produkt.name} (${foer} → ${efter})` +
          (a.note ? ` — ${a.note}` : ""),
      author: a.initials,
    },
  });
  return { linjeId, foer, efter, produkt };
}
