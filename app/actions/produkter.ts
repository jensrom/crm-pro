"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { kraevSuperAdmin } from "@/lib/auth";
import { formular } from "@/lib/formular";

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
  const f = formular(formData);
  const flytTil = f.tekst("flytTil");
  const sletLinjer = f.flueben("sletLinjer");

  const produkt = await db.product.findUnique({ where: { id } });
  if (!produkt) redirect("/indstillinger/produkter?fejl=findes-ikke");

  const linjer = await db.customerProduct.count({ where: { productId: id } });

  const flyt = linjer > 0 && !!flytTil && flytTil !== id;
  if (flyt && !(await db.product.findUnique({ where: { id: flytTil! }, select: { id: true } }))) {
    redirect(`/indstillinger/produkter?slet=${id}&fejl=ukendt-maal`);
  }
  if (linjer > 0 && !flyt && !sletLinjer) redirect(`/indstillinger/produkter?slet=${id}&fejl=vaelg-handling`);

  // Alt eller intet: linjerne flyttes/slettes, salgsmuligheder slippes, og licensen slettes i én transaktion
  await db.$transaction(async (tx) => {
    if (flyt) await tx.customerProduct.updateMany({ where: { productId: id }, data: { productId: flytTil! } });
    else if (linjer > 0) await tx.customerProduct.deleteMany({ where: { productId: id } });
    await tx.deal.updateMany({ where: { productId: id }, data: { productId: null } });
    await tx.product.delete({ where: { id } });
  });

  opfrisk();
  redirect(`/indstillinger/katalog?besked=licens-slettet&navn=${encodeURIComponent(produkt.name)}`);
}
