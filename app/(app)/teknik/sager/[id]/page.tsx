import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import { dato, datoKort, tal } from "@/lib/format";
import { AABNE_SAGSSTATUS, SAGSPRIORITET, SAGSSTATUS, findSagsprioritet, findSagsstatus } from "@/lib/labels";
import { alderIDage, alderTekst, kortnummer, kortstatus, sagsnummer, varighed } from "@/lib/teknik";
import { gemSag, registrerTid, skrivKommentar, sletKommentar, sletSag, sletTid } from "@/app/actions/teknik";

export const dynamic = "force-dynamic";

export default async function SagsSide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sag = await db.ticket.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, contacts: { where: { isActive: true } } } },
      contact: true,
      product: true,
      comments: { orderBy: { createdAt: "desc" } },
      timeLogs: { include: { bundle: true }, orderBy: { date: "desc" } },
    },
  });
  if (!sag) notFound();

  const [produkter, kort] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    db.hourBundle.findMany({ where: { companyId: sag.companyId, isActive: true }, orderBy: { number: "asc" } }),
  ]);

  const st = findSagsstatus(sag.status);
  const pr = findSagsprioritet(sag.priority);
  const brugt = sag.timeLogs.reduce((s, t) => s + t.durationMin, 0);
  const nu = new Date();
  const forfalden = sag.dueAt != null && sag.dueAt < nu && AABNE_SAGSSTATUS.includes(sag.status as any);

  return (
    <div className="max-w-[1200px] flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/teknik/sager" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Alle sager
          </Link>
          <h1 className="mt-1.5 text-xl font-semibold">{sag.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular">{sagsnummer(sag.number)}</span>
            <span>·</span>
            <Link href={`/kunder/${sag.company.id}`} className="hover:text-primary">{sag.company.name}</Link>
            <Badge variant={st.variant}>{st.label}</Badge>
            <Badge variant={pr.variant}>{pr.label}</Badge>
            {forfalden && <Badge variant="danger">Frist overskredet {datoKort(sag.dueAt)}</Badge>}
          </div>
        </div>
        <form action={async () => { "use server"; await sletSag(sag.id); }}>
          <Button variant="ghost" type="submit" size="sm" className="text-muted-foreground hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" /> Slet sag
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Alder</div>
          <div className="mt-1 text-2xl font-semibold">{alderTekst(alderIDage(sag.createdAt, nu))}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">oprettet {dato(sag.createdAt)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Tid brugt</div>
          <div className="mt-1 text-2xl font-semibold tabular">{brugt > 0 ? varighed(brugt) : "–"}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{tal(sag.timeLogs.length)} poster</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Produkt</div>
          <div className="mt-1 text-lg font-semibold truncate">{sag.product?.name ?? "–"}</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Kontakt</div>
          <div className="mt-1 text-lg font-semibold truncate">
            {sag.contact ? `${sag.contact.firstName} ${sag.contact.lastName}` : "–"}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Sagens oplysninger" />
            <CardBody>
              <form action={gemSag.bind(null, sag.id)} className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Label htmlFor="title">Titel</Label><Input id="title" name="title" defaultValue={sag.title} required /></div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select id="status" name="status" defaultValue={sag.status}>
                    {SAGSSTATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Prioritet</Label>
                  <Select id="priority" name="priority" defaultValue={sag.priority}>
                    {SAGSPRIORITET.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contactId">Kontakt</Label>
                  <Select id="contactId" name="contactId" defaultValue={sag.contactId ?? ""}>
                    <option value="">Ikke angivet</option>
                    {sag.company.contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="productId">Produkt</Label>
                  <Select id="productId" name="productId" defaultValue={sag.productId ?? ""}>
                    <option value="">Ikke angivet</option>
                    {produkter.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <div><Label htmlFor="dueAt">Aftalt frist</Label><Input id="dueAt" name="dueAt" type="date" defaultValue={sag.dueAt ? sag.dueAt.toISOString().slice(0, 10) : ""} /></div>
                <div className="sm:col-span-2"><Label htmlFor="description">Beskrivelse</Label><Textarea id="description" name="description" defaultValue={sag.description ?? ""} className="min-h-[110px]" /></div>
                <div className="sm:col-span-2 flex items-center justify-end gap-4">
                  <GemtAf af={sag.updatedBy} tid={sag.updatedAt} className="mr-auto" />
                  <Button type="submit">Gem sag</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Noter og beskeder" description="Markér som intern, hvis det ikke er noget kunden har fået at vide." />
            <CardBody className="p-0">
              <form action={skrivKommentar.bind(null, sag.id)} className="px-5 py-4 border-b border-border flex flex-col gap-3">
                <Textarea name="content" required placeholder="Hvad skete der?" className="min-h-[70px]" />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" name="isInternal" className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                    Intern note
                  </label>
                  <Button size="sm" type="submit">Tilføj</Button>
                </div>
              </form>
              {sag.comments.length === 0 ? (
                <div className="px-5"><EmptyState title="Ingen noter endnu" /></div>
              ) : (
                <ul className="divide-y divide-border">
                  {sag.comments.map((k) => (
                    <li key={k.id} className={k.isInternal ? "px-5 py-3 bg-warning/[0.05]" : "px-5 py-3"}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm whitespace-pre-wrap min-w-0">{k.content}</p>
                        <form action={sletKommentar.bind(null, k.id, sag.id)}>
                          <button type="submit" aria-label="Slet note" className="text-muted-foreground hover:text-danger p-1 rounded shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {k.isInternal && <span className="inline-flex items-center gap-1 text-warning"><Lock className="h-3 w-3" />Intern</span>}
                        {k.author && <span>{k.author}</span>}
                        <span className="tabular">{dato(k.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Tidsforbrug" description="Vælg et klippekort for at trække timerne derfra." />
          <CardBody className="p-0">
            <form action={registrerTid} className="px-5 py-4 border-b border-border grid grid-cols-2 gap-3 items-end">
              <input type="hidden" name="companyId" value={sag.companyId} />
              <input type="hidden" name="ticketId" value={sag.id} />
              <div><Label htmlFor="date">Dato</Label><Input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div><Label htmlFor="durationMin">Minutter</Label><Input id="durationMin" name="durationMin" type="number" min={1} step={5} required placeholder="fx 90" /></div>
              <div className="col-span-2">
                <Label htmlFor="bundleId">Træk fra klippekort</Label>
                <Select id="bundleId" name="bundleId" defaultValue="">
                  <option value="">Ikke fra et kort</option>
                  {kort.map((k) => {
                    const s = kortstatus(k);
                    return (
                      <option key={k.id} value={k.id} disabled={!s.brugbart}>
                        {kortnummer(k.number)}{k.name ? ` · ${k.name}` : ""} — {varighed(s.restMin)} tilbage
                        {s.udloebet ? " (udløbet)" : s.opbrugt ? " (opbrugt)" : ""}
                      </option>
                    );
                  })}
                </Select>
              </div>
              <div className="col-span-2"><Label htmlFor="description">Hvad lavede du?</Label><Input id="description" name="description" placeholder="valgfrit" /></div>
              <div className="col-span-2 flex justify-end"><Button size="sm" type="submit">Registrér tid</Button></div>
            </form>

            {sag.timeLogs.length === 0 ? (
              <div className="px-5"><EmptyState title="Ingen tid registreret" /></div>
            ) : (
              <ul className="divide-y divide-border">
                {sag.timeLogs.map((t) => (
                  <li key={t.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium tabular">{varighed(t.durationMin)}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="tabular">{datoKort(t.date)}</span>
                        {t.bundle && <> · {kortnummer(t.bundle.number)}</>}
                        {!t.isBillable && <> · ikke fakturerbar</>}
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                    </div>
                    <form action={async () => { "use server"; await sletTid(t.id); }}>
                      <button type="submit" aria-label="Slet tidspost" className="text-muted-foreground hover:text-danger p-1 rounded shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
