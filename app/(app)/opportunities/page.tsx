import { kanSkrive } from "@/lib/roller";
import { kraevBruger, kraevSkriv, kraevAdmin } from "@/lib/auth";
import Link from "next/link";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GemValg } from "@/components/ui/gem-valg";
import { GemtAf } from "@/components/ui/gemt-af";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { db } from "@/lib/db";
import { kroner, tal } from "@/lib/format";
import { STADIER } from "@/lib/labels";
import { afsluttetDage, delPipeline } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { flytStadie, opretSag, sletSag } from "@/app/actions/salg";

export const dynamic = "force-dynamic";

export default async function OpportunitiesSide({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  const mig = await kraevBruger();
  const skriv = kanSkrive(mig.ret.salg);
  const { alle } = await searchParams;
  const visAlle = alle === "1";
  const [sager, kunder, produkter, indst] = await Promise.all([
    db.deal.findMany({
      include: { company: { select: { id: true, name: true } }, product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.settings.findUnique({ where: { id: "singleton" }, select: { pipelineDoneDays: true } }),
  ]);
  const dage = afsluttetDage(indst?.pipelineDoneDays);
  const { ryddet } = delPipeline(sager, dage);
  const ryddetIds = new Set(ryddet.map((s) => s.id));
  const paaBoardet = visAlle ? sager : sager.filter((s) => !ryddetIds.has(s.id));


  /** Årsværdi: din egen indtastning slår beregningen fra pakkeprisen. */
  const vaerdi = (s: (typeof sager)[number]) =>
    s.value ?? (s.seatDelta && s.product?.pricePerUserMonth ? s.seatDelta * s.product.pricePerUserMonth * 12 : null);

  const leads = sager.filter((s) => s.stage === "ny");
  const aabne = sager.filter((s) => s.stage !== "ny" && s.stage !== "vundet" && s.stage !== "tabt");
  const KOLONNER = STADIER.filter((st) => st.key !== "ny");
  const licenserISpil = aabne.reduce((sum, s) => sum + (s.seatDelta ?? 0), 0);
  const vaegtet = aabne.reduce((sum, s) => sum + ((vaerdi(s) ?? 0) * s.probability) / 100, 0);
  const vundet = sager.filter((s) => s.stage === "vundet");

  return (
    <div className="max-w-[1500px] flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Åbne opportunities" value={tal(aabne.length)} sub={<Link href="/leads" className="hover:text-primary">{tal(leads.length)} leads venter på kvalificering →</Link>} />
        <StatCard label="Licenser i spil" value={tal(licenserISpil)} sub="på åbne opportunities" />
        <StatCard label="Vægtet årsværdi" value={vaegtet > 0 ? kroner(vaegtet) : "–"} sub="sandsynlighed × årsværdi" highlight />
        <StatCard tone="success" label="Vundet" value={tal(vundet.length)} sub={`${tal(vundet.reduce((s, d) => s + (d.seatDelta ?? 0), 0))} licenser`} />
      </div>

      {ryddet.length > 0 && (
        <p className="-mb-2 text-xs text-muted-foreground">
          {visAlle
            ? <>Viser alle afsluttede. <Link href="/opportunities" className="text-primary hover:underline">Ryd op igen</Link></>
            : <>Vundne og tabte står i {dage} dage. {tal(ryddet.length)} ældre er ryddet væk · <Link href="/opportunities?alle=1" className="text-primary hover:underline">vis alle</Link></>}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KOLONNER.map((st) => {
          const iStadie = paaBoardet.filter((s) => s.stage === st.key);
          return (
            <div key={st.key} className="flex flex-col gap-2.5 min-w-0">
              <div className="flex items-baseline justify-between px-1">
                <h2 className={cn("text-xs font-semibold uppercase tracking-wide", st.key === "vundet" ? "text-success" : "text-muted-foreground")}>{st.label}</h2>
                <span className="text-xs text-muted-foreground tabular">{iStadie.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {iStadie.map((s) => {
                  const vundetKort = s.stage === "vundet";
                  return (
                  <div
                    key={s.id}
                    className={cn(
                      "border rounded-lg p-3 flex flex-col gap-2",
                      vundetKort ? "bg-success/[0.07] border-success/35" : "bg-card border-border"
                    )}
                  >
                    <Link
                      href={`/kunder/${s.company.id}`}
                      className={cn("text-sm leading-tight", vundetKort ? "font-bold text-success hover:underline" : "font-medium hover:text-primary")}
                    >
                      {s.company.name}
                    </Link>
                    <p className={cn("text-xs leading-snug", vundetKort ? "font-semibold text-success/90" : "text-muted-foreground")}>{s.title}</p>
                    <div className={cn("flex items-center justify-between text-xs tabular", vundetKort ? "font-semibold text-success/90" : "text-muted-foreground")}>
                      <span>{s.seatDelta ? `${s.seatDelta} lic.` : "–"}{s.product ? ` · ${s.product.name}` : ""}</span>
                      <span>{vaerdi(s) != null ? kroner(vaerdi(s)) : `${s.probability} %`}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
                      {skriv && (
                      <GemValg
                        action={async (fd: FormData) => {
                          "use server";
                          const valgt = fd.get("stage");
                          if (typeof valgt === "string" && valgt && valgt !== s.stage) await flytStadie(s.id, valgt);
                        }}
                        name="stage"
                        value={s.stage}
                        options={STADIER}
                        ariaLabel={`Stadie for ${s.title}`}
                        selectClassName="h-8 text-xs min-w-0"
                      />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <GemtAf af={s.updatedBy} tid={s.updatedAt} className="text-[11px] leading-tight min-w-0 truncate" />
                      {skriv && (
                      <form action={async () => { "use server"; await sletSag(s.id); }} className="flex justify-end">
                        <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground">
                          Slet
                        </Button>
                      </form>
                      )}
                      </div>
                    </div>
                  </div>
                  );
                })}
                {iStadie.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                    Tom
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {skriv && (
      <Card>
        <CardHeader title="Ny opportunity" description="Kvalificeret salgsmulighed. Ukvalificerede henvendelser oprettes som leads. Værdien beregnes fra pakke × licenser, hvis du ikke selv sætter den." />
        <CardBody>
          <form action={opretSag} className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="sm:col-span-2">
              <Label htmlFor="pc">Kunde</Label>
              <Select id="pc" name="companyId" required>
                {kunder.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="pt">Titel</Label><Input id="pt" name="title" required placeholder="fx Opgradering til Medium" /></div>
            <div><Label htmlFor="pd">Licenser</Label><Input id="pd" name="seatDelta" type="number" min={0} /></div>
            <div>
              <Label htmlFor="ppak">Pakke</Label>
              <Select id="ppak" name="productId" defaultValue="">
                <option value="">Ingen</option>
                {produkter.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div><Label htmlFor="pv">Årsværdi (kr.)</Label><Input id="pv" name="value" inputMode="decimal" placeholder="valgfri" /></div>
            <div>
              <Label htmlFor="ps">Stadie</Label>
              <Select id="ps" name="stage" defaultValue="kvalificeret">
                {KOLONNER.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <div><Label htmlFor="pp">Sandsynlighed %</Label><Input id="pp" name="probability" type="number" min={0} max={100} placeholder="efter stadie" /></div>
            <div><Label htmlFor="pe">Forventet luk</Label><Input id="pe" name="expectedCloseDate" type="date" /></div>
            <div className="sm:col-span-3 lg:col-span-2"><Textarea name="notes" placeholder="Noter (valgfri)" className="min-h-[38px]" /></div>
            <div className="flex justify-end"><Button type="submit">Opret opportunity</Button></div>
          </form>
        </CardBody>
      </Card>
      )}
    </div>
  );
}
