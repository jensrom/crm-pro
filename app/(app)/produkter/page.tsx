import Link from "next/link";
import { Boxes, Check, Package, Settings2 } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { kroner, tal } from "@/lib/format";
import { gaeldendeMaanedspris } from "@/lib/pricing";
import { licensmodel, listepris } from "@/lib/katalog";
import { ProduktMaerke } from "@/lib/produktstil";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BESKEDER: Record<string, string> = {
  flyttet: "Kunderne er flyttet til licensen.",
};

export default async function ProdukterSide({
  searchParams,
}: {
  searchParams: Promise<{ pakke?: string; besked?: string }>;
}) {
  const { pakke, besked } = await searchParams;

  const [produkter, familier, mig] = await Promise.all([
    db.product.findMany({
      include: {
        customerProducts: { select: { seats: true, unitPriceMonth: true } },
        _count: { select: { deals: true } },
      },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
    }),
    db.productFamily.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    hentSession(),
  ]);

  // Licenserne grupperet under deres produkt, i katalogets rækkefølge.
  const grupper = [
    ...familier.map((f) => ({ id: f.id, navn: f.name, licenser: produkter.filter((p) => p.familyId === f.id) })),
    { id: "uden", navn: "Uden produkt", licenser: produkter.filter((p) => p.familyId == null) },
  ].filter((g) => g.licenser.length > 0);
  const ordnet = grupper.flatMap((g) => g.licenser);

  const valgt = ordnet.find((p) => p.id === pakke) ?? ordnet[0];

  const alleLinjer = produkter.flatMap((p) => p.customerProducts.map((l) => ({ ...l, produkt: p })));
  const samletLicenser = alleLinjer.reduce((s, l) => s + l.seats, 0);
  const samletVaerdi = alleLinjer.reduce((s, l) => {
    const pris = gaeldendeMaanedspris(l.unitPriceMonth, l.produkt);
    return s + (pris == null ? 0 : l.seats * pris * 12);
  }, 0);
  const udenPris = alleLinjer.filter((l) => gaeldendeMaanedspris(l.unitPriceMonth, l.produkt) == null).length;

  return (
    <div className="max-w-[1400px] flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-info/40 bg-info/[0.05]">
          <CardBody className="text-sm">{BESKEDER[besked]}</CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aktive licenstyper" value={tal(produkter.filter((p) => p.isActive).length)} sub={`${tal(familier.length)} produkter`} />
        <StatCard label="Licenser i alt" value={tal(samletLicenser)} sub="på tværs af produkter" />
        <StatCard label="Årlig licensværdi" value={kroner(samletVaerdi)} sub="subscription, nuværende licenser" highlight />
        <StatCard label="Linjer uden pris" value={tal(udenPris)} sub={udenPris ? "tæller ikke med i værdien" : "alt er prissat"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr] items-start">
        {/* Venstre: kataloget */}
        <div className="flex flex-col gap-4">
          {grupper.map((g) => (
            <div key={g.id} className="flex flex-col gap-2">
              <div className="px-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Boxes className="h-3.5 w-3.5" /> {g.navn}
              </div>
              {g.licenser.map((p) => {
                const licenser = p.customerProducts.reduce((s, l) => s + l.seats, 0);
                const aktiv = p.id === valgt?.id;
                const pris = listepris(p);
                return (
                  <Link
                    key={p.id}
                    href={`/produkter?pakke=${p.id}`}
                    className={cn(
                      "block rounded-xl border px-4 py-3 transition-colors",
                      aktiv ? "border-primary bg-primary/[0.06]" : "border-border bg-card hover:bg-secondary/60",
                      !p.isActive && "opacity-60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("flex items-center gap-2 min-w-0 text-sm font-semibold", aktiv && "text-primary")}>
                        <ProduktMaerke icon={p.icon} color={p.color} size="md" />
                        <span className="truncate">{p.name}</span>
                      </span>
                      {aktiv && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground tabular">
                      {pris != null ? `${kroner(pris)} ${licensmodel(p.licenseModel).enhed}` : "ingen pris sat"}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground tabular">
                      <span>{p.customerProducts.length} {p.customerProducts.length === 1 ? "kunde" : "kunder"}</span>
                      <span>·</span>
                      <span>{licenser} licenser</span>
                      {p.licenseModel === "perpetual" && <Badge variant="warning">Perpetual</Badge>}
                      {p.licenseModel === "fee" && <Badge variant="info">Engangsydelse</Badge>}
                      {!p.isActive && <Badge variant="muted">Arkiveret</Badge>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}

          {mig?.erSuperAdmin && (
            <Link
              href="/indstillinger/katalog"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60"
            >
              <Settings2 className="h-4 w-4" /> Rediger katalog
            </Link>
          )}
        </div>

        {/* Højre: den valgte licens. Hvem der har den, ses på kunden selv. */}
        <div className="flex flex-col gap-5">
          {!valgt ? (
            <Card>
              <CardBody>
                <EmptyState
                  title="Ingen licenser endnu"
                  icon={Package}
                  description="Produkter og licenser oprettes af en superadministrator under Indstillinger → Katalog."
                />
              </CardBody>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={<span className="flex items-center gap-2"><ProduktMaerke icon={valgt.icon} color={valgt.color} size="md" />{valgt.name}</span>}
                  description={
                    `${licensmodel(valgt.licenseModel).label} · ` +
                    (listepris(valgt) != null ? `${kroner(listepris(valgt))} ${licensmodel(valgt.licenseModel).enhed}` : "ingen pris") +
                    (valgt.sku ? ` · ${valgt.sku}` : "")
                  }
                  action={
                    mig?.erSuperAdmin ? (
                      <Link href={`/indstillinger/katalog?licens=${valgt.id}`}>
                        <Button size="sm" variant="secondary"><Settings2 className="h-3.5 w-3.5" /> Rediger i katalog</Button>
                      </Link>
                    ) : undefined
                  }
                />
                {valgt.description && <CardBody className="text-sm text-muted-foreground">{valgt.description}</CardBody>}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
