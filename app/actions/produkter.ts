"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kraevBruger, kraevSuperAdmin } from "@/lib/auth";

const txt = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};
const num = (v: FormDataEntryValue | null) => {
  const s = txt(v);
  if (s == null) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function opfrisk() {
  revalidatePath("/produkter");
  revalidatePath("/dashboard");
  revalidatePath("/kunder");
  revalidatePath("/pipeline");
  revalidatePath("/indstillinger");
  revalidatePath("/indstillinger/katalog");
}

export async function skiftAktiv(id: string, aktiv: boolean) {
  await kraevSuperAdmin();
  await db.product.update({ where: { id }, data: { isActive: aktiv } });
  opfrisk();
}

/**
 * Flytter flere kunder til samme produkt på én gang.
 * Linjer der allerede ligger på målproduktet springes over.
 */
export async function flytFlereLinjer(formData: FormData) {
  await kraevBruger();
  const productId = txt(formData.get("productId"));
  const ids = formData.getAll("linjeId").filter((v): v is string => typeof v === "string" && v !== "");
  if (!productId || ids.length === 0) return;

  await db.customerProduct.updateMany({
    where: { id: { in: ids }, NOT: { productId } },
    data: { productId },
  });
  opfrisk();
  redirect(`/produkter?pakke=${productId}&besked=flyttet`);
}

/**
 * Sletter et produkt endeligt.
 *
 * Har produktet kunder på, skal du sige hvad der skal ske med deres licenslinjer:
 * enten flyttes de til et andet produkt, eller også slettes de sammen med produktet.
 * Uden et af de to valg sker der ingenting — en licenslinje må ikke bare forsvinde,
 * fordi det er den der bærer hvor mange licenser kunden har.
 *
 * Sager der peger på produktet mister blot produktreferencen; selve sagen består.
 */
export async function sletProduktEndeligt(id: string, formData: FormData) {
  await kraevSuperAdmin();
  const flytTil = txt(formData.get("flytTil"));
  const sletLinjer = formData.get("sletLinjer") === "on";

  const produkt = await db.product.findUnique({ where: { id } });
  if (!produkt) redirect("/indstillinger/produkter?fejl=findes-ikke");

  const linjer = await db.customerProduct.count({ where: { productId: id } });

  if (linjer > 0) {
    if (flytTil && flytTil !== id) {
      const maal = await db.product.findUnique({ where: { id: flytTil } });
      if (!maal) redirect(`/indstillinger/produkter?slet=${id}&fejl=ukendt-maal`);
      await db.customerProduct.updateMany({ where: { productId: id }, data: { productId: flytTil } });
    } else if (sletLinjer) {
      await db.customerProduct.deleteMany({ where: { productId: id } });
    } else {
      redirect(`/indstillinger/produkter?slet=${id}&fejl=vaelg-handling`);
    }
  }

  await db.deal.updateMany({ where: { productId: id }, data: { productId: null } });
  await db.product.delete({ where: { id } });

  opfrisk();
  redirect(`/indstillinger/katalog?besked=licens-slettet&navn=${encodeURIComponent(produkt.name)}`);
}
