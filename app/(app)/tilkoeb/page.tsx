import Link from "next/link";
import { Minus, PackagePlus, Plus } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { db } from "@/lib/db";
import { datoKort, kroner, tal } from "@/lib/format";
import { licensmodel } from "@/lib/katalog";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAANEDER = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/**
 * Overblik over tilkøb og reduktioner på tværs af kunder.
 * Værdier regnes på prisen der blev registreret på posten — ikke dagens pris.
 */
export default async function TilkoebSide({
  searchParams,
}: {
  searchParams: Promise<{ aar?: string; produkt?: string; kunde?: string }>;
}) {
  const { aar, produkt, kunde } = await searchParams;
  const iAar = new Date().getFullYear();
  const valgtAar = aar === "alle" ? null : Number(aar) || iAar;

  const [familier, kundeNavn, foersteDato] = await Promise.all([
    db.productFamily.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    kunde ? db.company.findUnique({ where: { id: kunde }, select: { name: true } }) : null,
    db.licenseChange.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
  ]);

  const poster = await db.licenseChange.findMany({
    where: {
      ...(valgtAar ? { date: { gte: new Date(valgtAar, 0, 1), lt: new Date(valgtAar + 1, 0, 1) } } : {}),
      ...(produkt ? { product: { familyId: produkt } } : {}),
      ...(kunde ? { companyId: kunde } : {}),
    },
    include: {
      company: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, family: { select: { name: true } } } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const vaerdi = (p: (typeof poster)[number]) => (p.unitPrice == null ? 0 : p.quantity * p.unitPrice);
  const tilkoebt = poster.filter((p) => p.quantity > 0).reduce((s, p) => s + p.quantity, 0);
  const reduceret = poster.filter((p) => p.quantity < 0).reduce((s, p) => s - p.quantity, 0);
  const aarsvaerdi = poster.filter((p) => p.licenseModel !== "perpetual").reduce((s, p) => s + vaerdi(p) * 12, 0);
  const engang = poster.filter((p) => p.licenseModel === "perpetual").reduce((s, p) => s + vaerdi(p), 0);
  const udenPris = poster.filter((p) => p.unitPrice == null).length;

  // Pr. licens
  const prLicens = new Map<string, { navn: string; produkt: string; model: string; plus: number; minus: number; vaerdi: number }>();
  for (const p of poster) {
    const r = prLicens.get(p.productId) ?? {
      navn: p.product.name, produkt: p.product.family?.name ?? "Uden produkt", model: p.licenseModel, plus: 0, minus: 0, vaerdi: 0,
    };
    if (p.quantity > 0) r.plus += p.quantity;
    else r.minus -= p.quantity;
    r.vaerdi += vaerdi(p) * (p.licenseModel === "perpetual" ? 1 : 12);
    prLicens.set(p.productId, r);
  }
  const licensRaekker = [...prLicens.values()].sort((a, b) => b.plus - b.minus - (a.plus - a.minus));

  // Pr. måned (kun når et enkelt år er valgt)
  const prMaaned = valgtAar
    ? MAANEDER.map((_, i) => poster.filter((p) => p.date.getMonth() === i).reduce((s, p) => s + p.quantity, 0))
    : null;
  const maksMaaned = prMaaned ? Math.max(1, ...prMaaned.map(Math.abs)) : 1;

  const startAar = foersteDato?.date.getFullYear() ?? iAar;
  const aarValg: number[] = [];
  for (let a = iAar; a >= Math.min(startAar, iAar); a--) aarValg.push(a);

  return (
    <div className="max-w-[1300px] flex flex-col gap-5">
      <Card>
        <CardBody>
          <form className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <Label htmlFor="aar">År</Label>
              <Select id="aar" name="aar" defaultValue={valgtAar ? String(valgtAar) : "alle"}>
                {aarValg.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="alle">Alle år</option>
              </Select>
            </div>
            <div className="w-52">
              <Label htmlFor="produkt">Produkt</Label>
              <Select id="produkt" name="produkt" defaultValue={produkt ?? ""}>
                <option value="">Alle produkter</option>
                {familier.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </div>
            {kunde && <input type="hidden" name="kunde" value={kunde} />}
            <Button type="submit" size="sm" variant="secondary">Vis</Button>
            {kundeNavn && (
              <span className="text-sm text-muted-foreground">
                Kun <Link href={`/kunder/${kunde}`} className="text-primary hover:underline">{kundeNavn.name}</Link> ·{" "}
                <Link href={`/tilkoeb?aar=${valgtAar ?? "alle"}${produkt ? `&produkt=${produkt}` : ""}`} className="hover:underline">vis alle kunder</Link>
              </span>
            )}
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tilkøbte licenser" value={tal(tilkoebt)} sub={`${tal(reduceret)} reduceret · netto ${tilkoebt - reduceret >= 0 ? "+" : ""}${tal(tilkoebt - reduceret)}`} />
        <StatCard label="Ny årlig værdi" value={kroner(aarsvaerdi)} sub="subscription, netto" highlight />
        <StatCard label="Engangsbeløb" value={kroner(engang)} sub="perpetual, netto" />
        <StatCard label="Registreringer" value={tal(poster.length)} sub={udenPris ? `${tal(udenPris)} uden pris` : "alle med pris"} />
      </div>

      {prMaaned && (
        <Card>
          <CardHeader title={`Netto licenser pr. måned ${valgtAar}`} />
          <CardBody>
            <div className="grid grid-cols-12 gap-2 items-end h-36">
              {prMaaned.map((v, i) => (
                <div key={i} className="flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-[11px] tabular text-muted-foreground">{v !== 0 ? (v > 0 ? `+${v}` : v) : ""}</span>
                  <div
                    className={cn("w-full rounded-t", v >= 0 ? "bg-primary" : "bg-danger")}
                    style={{ height: `${(Math.abs(v) / maksMaaned) * 100}%`, minHeight: v !== 0 ? 3 : 0 }}
                    aria-label={`${MAANEDER[i]}: ${v}`}
                  />
                  <span className="text-[11px] text-muted-foreground">{MAANEDER[i]}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr] items-start">
        <Card>
          <CardHeader title="Pr. licens" />
          <CardBody className="p-0">
            {licensRaekker.length === 0 ? (
              <div className="px-5"><EmptyState title="Intet i perioden" icon={PackagePlus} /></div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Licens</th>
                    <th className="px-3 py-2.5 font-medium text-right">+</th>
                    <th className="px-3 py-2.5 font-medium text-right">−</th>
                    <th className="px-5 py-2.5 font-medium text-right">Værdi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {licensRaekker.map((r) => (
                    <tr key={r.navn + r.produkt}>
                      <td className="px-5 py-2.5">
                        <div className="font-medium">{r.navn}</div>
                        <div className="text-xs text-muted-foreground">{r.produkt} · {licensmodel(r.model).kort}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular text-success">{r.plus || "–"}</td>
                      <td className="px-3 py-2.5 text-right tabular text-danger">{r.minus || "–"}</td>
                      <td className="px-5 py-2.5 text-right tabular">
                        {kroner(r.vaerdi)}
                        <span className="text-xs text-muted-foreground">{r.model === "perpetual" ? " engang" : "/år"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Registreringer" description="Registreres på kundens side under Tilkøb og licensændringer." />
          <CardBody className="p-0">
            {poster.length === 0 ? (
              <div className="px-5"><EmptyState title="Ingen tilkøb i perioden" icon={PackagePlus} /></div>
            ) : (
              <ul className="divide-y divide-border">
                {poster.map((p) => {
                  const perpetual = p.licenseModel === "perpetual";
                  const v = p.unitPrice == null ? null : vaerdi(p) * (perpetual ? 1 : 12);
                  return (
                    <li key={p.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm flex items-center gap-1.5">
                          {p.quantity > 0
                            ? <Plus className="h-3.5 w-3.5 text-success shrink-0" />
                            : <Minus className="h-3.5 w-3.5 text-danger shrink-0" />}
                          <span className="font-medium tabular">{Math.abs(p.quantity)}</span> × {p.product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <Link href={`/kunder/${p.company.id}#tilkoeb`} className="hover:text-primary">{p.company.name}</Link>
                          {" · "}<span className="tabular">{datoKort(p.date)}</span>
                          {" · "}<span className="tabular">{p.seatsBefore} → {p.seatsAfter}</span>
                          {p.createdBy && ` · ${p.createdBy}`}
                          {p.note && ` · ${p.note}`}
                        </div>
                      </div>
                      <span className={cn("text-xs tabular shrink-0", v != null && v < 0 && "text-danger")}>
                        {v == null ? "ingen pris" : `${v > 0 ? "+" : ""}${kroner(v)}${perpetual ? " engang" : "/år"}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
