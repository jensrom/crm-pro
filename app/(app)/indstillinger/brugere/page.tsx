import Link from "next/link";
import { AlertTriangle, KeyRound, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { GemtAf } from "@/components/ui/gemt-af";
import { db } from "@/lib/db";
import { hentSession } from "@/lib/auth";
import { dato } from "@/lib/format";
import { gemBruger, nulstilPin, opretBruger, sletBruger } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  mangler: "Initialer, navn og PIN skal udfyldes.",
  pin: "PIN skal være 4–8 cifre.",
  initialer: "De initialer er allerede i brug.",
  "sidste-admin": "Der skal altid være mindst én aktiv administrator tilbage.",
  "sig-selv": "Du kan ikke slette din egen bruger.",
};

const BESKEDER: Record<string, string> = {
  oprettet: "Brugeren er oprettet.",
  gemt: "Brugeren er gemt.",
  pin: "PIN'en er nulstillet.",
  slettet: "Brugeren er slettet.",
};

export default async function BrugerSide({
  searchParams,
}: {
  searchParams: Promise<{ rediger?: string; besked?: string; fejl?: string }>;
}) {
  const { rediger, besked, fejl } = await searchParams;
  const [brugere, mig] = await Promise.all([
    db.user.findMany({ orderBy: [{ isActive: "desc" }, { initials: "asc" }] }),
    hentSession(),
  ]);
  const under = rediger ? brugere.find((b) => b.id === rediger) : null;

  return (
    <div className="max-w-4xl flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-success/40 bg-success/[0.06]"><CardBody className="text-sm">{BESKEDER[besked]}</CardBody></Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            {FEJL[fejl]}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Brugere" description="Login sker med initialer og PIN. Alt andet udfylder du her." />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-5 py-2.5 font-medium">Initialer</th>
                  <th className="px-3 py-2.5 font-medium">Navn</th>
                  <th className="px-3 py-2.5 font-medium">Mail</th>
                  <th className="px-3 py-2.5 font-medium">Rolle</th>
                  <th className="px-3 py-2.5 font-medium">Sidst logget ind</th>
                  <th className="px-5 py-2.5 font-medium text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brugere.map((b) => (
                  <tr key={b.id} className={cn("hover:bg-secondary/60", !b.isActive && "opacity-60")}>
                    <td className="px-5 py-2.5 font-semibold tracking-widest">{b.initials}</td>
                    <td className="px-3 py-2.5">
                      {b.name}
                      {b.id === mig?.id && <span className="ml-2 text-xs text-muted-foreground">(dig)</span>}
                      {b.title && <div className="text-xs text-muted-foreground">{b.title}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs break-all">{b.email ?? "–"}</td>
                    <td className="px-3 py-2.5">
                      {b.role === "admin"
                        ? <Badge variant="default"><ShieldCheck className="h-3 w-3 mr-1 inline" />Administrator</Badge>
                        : <Badge variant="muted">Bruger</Badge>}
                      {!b.isActive && <Badge variant="muted" className="ml-1.5">Spærret</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground tabular">{b.lastLoginAt ? dato(b.lastLoginAt) : "aldrig"}</td>
                    <td className="px-5 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/indstillinger/brugere?rediger=${b.id}`}>
                          <Button size="sm" variant="ghost" type="button" className="text-xs px-2">Rediger</Button>
                        </Link>
                        <form action={async () => { "use server"; await sletBruger(b.id); }}>
                          <button type="submit" aria-label={`Slet ${b.initials}`} className="p-1 rounded text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {under ? (
        <>
          <Card>
            <CardHeader title={`Rediger ${under.initials}`} description="Initialerne kan ikke ændres — de er brugerens identitet i systemet." />
            <CardBody>
              <form action={gemBruger.bind(null, under.id)} className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Label htmlFor="name">Navn</Label><Input id="name" name="name" defaultValue={under.name} required /></div>
                <div><Label htmlFor="email">Mail</Label><Input id="email" name="email" type="email" defaultValue={under.email ?? ""} /></div>
                <div><Label htmlFor="phone">Telefon</Label><Input id="phone" name="phone" defaultValue={under.phone ?? ""} /></div>
                <div><Label htmlFor="title">Stilling</Label><Input id="title" name="title" defaultValue={under.title ?? ""} /></div>
                <div>
                  <Label htmlFor="role">Rolle</Label>
                  <Select id="role" name="role" defaultValue={under.role}>
                    <option value="bruger">Bruger</option>
                    <option value="admin">Administrator</option>
                  </Select>
                </div>
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={under.isActive} className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                  Aktiv — kan logge ind
                </label>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                  <GemtAf af={under.updatedBy} tid={under.updatedAt} className="mr-auto" />
                  <Link href="/indstillinger/brugere"><Button variant="secondary" type="button">Fortryd</Button></Link>
                  <Button type="submit">Gem bruger</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Nulstil PIN" description="Du kan ikke se den gamle PIN — kun sætte en ny." />
            <CardBody>
              <form action={nulstilPin.bind(null, under.id)} className="flex items-end gap-3">
                <div className="w-48">
                  <Label htmlFor="npin">Ny PIN (4–8 cifre)</Label>
                  <Input id="npin" name="pin" type="password" inputMode="numeric" required placeholder="••••" />
                </div>
                <Button variant="secondary" type="submit"><KeyRound className="h-3.5 w-3.5" /> Sæt ny PIN</Button>
              </form>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader title="Ny bruger" description="Initialer og PIN er login. Resten er oplysninger du selv udfylder." />
          <CardBody>
            <form action={opretBruger} className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ninitials">Initialer</Label>
                <Input id="ninitials" name="initials" required maxLength={8} placeholder="JPR" className="uppercase tracking-widest" />
              </div>
              <div><Label htmlFor="npin2">PIN (4–8 cifre)</Label><Input id="npin2" name="pin" type="password" inputMode="numeric" required placeholder="••••" /></div>
              <div className="sm:col-span-2"><Label htmlFor="nname">Navn</Label><Input id="nname" name="name" required /></div>
              <div><Label htmlFor="nemail">Mail</Label><Input id="nemail" name="email" type="email" /></div>
              <div><Label htmlFor="nphone">Telefon</Label><Input id="nphone" name="phone" /></div>
              <div><Label htmlFor="ntitle">Stilling</Label><Input id="ntitle" name="title" /></div>
              <div>
                <Label htmlFor="nrole">Rolle</Label>
                <Select id="nrole" name="role" defaultValue="bruger">
                  <option value="bruger">Bruger</option>
                  <option value="admin">Administrator</option>
                </Select>
              </div>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><UserPlus className="h-3.5 w-3.5" /> Opret bruger</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-muted-foreground max-w-prose">
        PIN'en gemmes som en scrypt-hash med eget salt — hverken du eller nogen anden kan læse den ud af databasen.
        Ligger databasefilen på et drev andre kan åbne, kan de dog stadig læse alt indhold direkte i filen.
        PIN-koden spærrer programmet, ikke filen.
      </p>
    </div>
  );
}
