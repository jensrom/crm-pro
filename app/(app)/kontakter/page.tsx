import { db } from "@/lib/db";
import { BESLUTNINGSROLLER, label } from "@/lib/labels";
import { kundeNr } from "@/lib/kundenr";
import { KontaktSoeg, type SoegKontakt } from "@/components/kontakter/KontaktSoeg";

export const dynamic = "force-dynamic";

/** Kontakter: tom til der søges. Søgningen matcher både personer og kunder og grupperer pr. kunde. */
export default async function KontakterSide({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const kontakter = await db.contact.findMany({
    where: { isActive: true },
    include: { company: { select: { id: true, name: true, department: true, customerNumber: true, city: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const data: SoegKontakt[] = kontakter.map((c) => ({
    id: c.id,
    navn: `${c.firstName} ${c.lastName}`.trim(),
    titel: c.title,
    rolle: c.decisionRole ? label(BESLUTNINGSROLLER, c.decisionRole) : null,
    email: c.email,
    telefon: c.phone,
    primaer: c.isPrimary,
    kunde: c.company
      ? { id: c.company.id, navn: c.company.name, afdeling: c.company.department, nummer: kundeNr(c.company.customerNumber), by: c.company.city }
      : null,
  }));

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Søg på en person eller en kunde. Et kundenavn viser alle kundens kontakter; et personnavn viser personen under hver kunde, hvor navnet findes.
      </p>
      <KontaktSoeg kontakter={data} start={q ?? ""} />
    </div>
  );
}
