import { existsSync, statSync } from "node:fs";
import { AlertTriangle, Archive, Database, HardDrive, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { StiInput } from "@/components/ui/sti-input";
import { databaseSti, konfigfilSti, laesKonfig, netvaerksAdvarsel, synkroniseretAdvarsel } from "@/lib/config";
import { db } from "@/lib/db";
import { dato, tal, tidspunkt } from "@/lib/format";
import { backupMappe, listBackups } from "@/lib/backup";
import { navneOpslag } from "@/lib/brugere";
import { gemDatabaseplacering, gendanBackup, sletBackup, tagBackup } from "@/app/actions/database";

export const dynamic = "force-dynamic";

const FEJL: Record<string, string> = {
  tom: "Skriv en sti til databasefilen.",
  sti: "Stien kan ikke bruges.",
  kopi: "Databasen kunne ikke kopieres til den nye placering.",
  backup: "Sikkerhedskopien kunne ikke laves.",
  gendan:
    "Gendannelsen kunne ikke gennemføres. Har en kollega programmet åbent på den samme database, holder Windows fat i filen — luk det hos jer begge og prøv igen.",
  vaelg: "Vælg en sikkerhedskopi først.",
  findes_ikke: "Den sikkerhedskopi findes ikke længere.",
  bekraeft: "Sæt fluebenet for at bekræfte at den nuværende database må overskrives.",
};

const BESKEDER: Record<string, string> = {
  gemt: "Placeringen er gemt. Genstart programmet, så den træder i kraft.",
  uaendret: "Stien er den samme som før — der er ikke ændret noget.",
  backup: "Sikkerhedskopien er lavet.",
  gendannet: "Databasen er gendannet. Luk programmet og start det igen, så alle sider læser den nye fil.",
  slettet: "Sikkerhedskopien er slettet.",
};

/** 1 234 KB, eller MB når det bliver stort. */
function filstoerrelse(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${tal(bytes / (1024 * 1024), 1)} MB`
    : `${tal(Math.round(bytes / 1024))} KB`;
}

export default async function DatabaseSide({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string; fejl?: string; grund?: string; fil?: string }>;
}) {
  const { besked, fejl, grund, fil } = await searchParams;
  const k = laesKonfig();
  const sti = databaseSti(k);
  const findes = existsSync(sti);
  const stat = findes ? statSync(sti) : null;

  const [kunder, sager] = await Promise.all([db.company.count(), db.ticket.count()]);

  const sync = synkroniseretAdvarsel(sti);
  const netvaerk = netvaerksAdvarsel(k.databasePath);

  const backups = listBackups();
  const navne = await navneOpslag();
  const nyeste = backups[0] ?? null;

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      {besked && BESKEDER[besked] && (
        <Card className="border-success/40 bg-success/[0.06]">
          <CardBody className="text-sm">
            {BESKEDER[besked]}
            {fil && <span className="block text-xs text-muted-foreground mt-1 font-mono break-all">{decodeURIComponent(fil)}</span>}
          </CardBody>
        </Card>
      )}
      {fejl && FEJL[fejl] && (
        <Card className="border-danger/40 bg-danger/[0.06]">
          <CardBody className="text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
            <span>{FEJL[fejl]}{grund ? ` (${decodeURIComponent(grund)})` : ""}</span>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Nuværende database" description="Sådan ser det ud lige nu." />
        <CardBody className="flex flex-col gap-3 text-sm">
          <Raek label="Fil" vaerdi={<code className="text-xs break-all">{sti}</code>} />
          <Raek label="Status" vaerdi={findes ? <Badge variant="success">Fundet</Badge> : <Badge variant="danger">Ikke fundet</Badge>} />
          {stat && <Raek label="Størrelse" vaerdi={`${tal(Math.round(stat.size / 1024))} KB`} />}
          {stat && <Raek label="Sidst ændret" vaerdi={dato(stat.mtime)} />}
          <Raek label="Indhold" vaerdi={`${tal(kunder)} kunder · ${tal(sager)} sager`} />
          <Raek label="Konfigurationsfil" vaerdi={<code className="text-xs break-all">{konfigfilSti()}</code>} />
        </CardBody>
      </Card>

      {(sync || netvaerk) && (
        <Card className={sync ? "border-danger/50 bg-danger/[0.05]" : "border-warning/50 bg-warning/[0.05]"}>
          <CardBody className="flex items-start gap-3 text-sm">
            <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${sync ? "text-danger" : "text-warning"}`} />
            <div className="flex flex-col gap-1.5">
              {sync && (
                <p>
                  <b>Databasen ligger i en mappe der synkroniseres ({sync}).</b> Det er den ene placering der
                  med sikkerhed ødelægger en SQLite-fil før eller siden: synkroniseringen kopierer filen midt i
                  en skrivning. Flyt den til et almindeligt drev.
                </p>
              )}
              {netvaerk && !sync && (
                <p>
                  <b>Databasen ligger på et netværksdrev.</b> Det virker, men SQLites fillåse er upålidelige over
                  netværk. Hold jer til én åben ad gangen, og tag hyppige kopier.
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Flyt databasen" description="Skriv en fuld sti til .db-filen. Ændringen træder i kraft efter genstart." />
        <CardBody>
          <form action={gemDatabaseplacering} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="databasePath">Sti til databasefilen</Label>
              <StiInput
                id="databasePath"
                name="databasePath"
                defaultValue={k.databasePath}
                dialogMode="save"
                filterType="database"
                dialogTitel="Vælg placering til databasefilen"
                placeholder="D:\\CRM-Pro\\crm-pro.db"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Relativ sti regnes fra programmappen. Et netværksdrev skrives som{" "}
                <code>\\server\share\mappe\crm-pro.db</code>.
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="kopier" defaultChecked className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
              <span>
                Kopiér den nuværende database til den nye placering
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Kun hvis der ikke allerede ligger en fil der. Er feltet slået fra, starter du på en tom base
                  som skal have <code>npm run db:upgrade</code> kørt.
                </span>
              </span>
            </label>

            <div className="flex justify-end"><Button type="submit">Gem placering</Button></div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Archive className="h-4 w-4 text-primary" />Sikkerhedskopier</span>}
          description="En kopi af hele databasen — kunder, sager, klippekort, brugere og logo."
          action={
            <form action={tagBackup}>
              <Button size="sm" type="submit">Tag backup nu</Button>
            </form>
          }
        />
        <CardBody className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Kopierne ligger i <code className="break-all">{backupMappe()}</code> — altså ved siden af databasen.
            Flytter du databasen ud på et fællesdrev, følger kopierne med derud.
          </p>

          {backups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Der er ingen sikkerhedskopier endnu.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">Tidspunkt</th>
                    <th className="px-3 py-2 font-medium">Taget af</th>
                    <th className="px-3 py-2 font-medium text-right">Størrelse</th>
                    <th className="px-4 py-2 font-medium w-9"><span className="sr-only">Slet</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {backups.map((b) => (
                    <tr key={b.filnavn} className="hover:bg-secondary/40">
                      <td className="px-4 py-2.5">
                        <span className="tabular">{tidspunkt(b.tid)}</span>
                        {b === nyeste && <Badge variant="success" className="ml-2">Nyeste</Badge>}
                        {b.automatisk && <Badge variant="muted" className="ml-2">Før gendannelse</Badge>}
                        <span className="block text-[11px] text-muted-foreground font-mono break-all">{b.filnavn}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{b.af ? navne.get(b.af) ?? b.af : "–"}</td>
                      <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{filstoerrelse(b.bytes)}</td>
                      <td className="px-4 py-2">
                        <form action={sletBackup}>
                          <input type="hidden" name="filnavn" value={b.filnavn} />
                          <button type="submit" aria-label={`Slet kopien fra ${tidspunkt(b.tid)}`} className="p-1 rounded text-muted-foreground hover:text-danger">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {backups.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader
            title={<span className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-warning" />Gendan en tidligere udgave</span>}
            description="Den nuværende database overskrives. Der tages automatisk en kopi af den først, så du også kan fortryde selve gendannelsen."
          />
          <CardBody>
            <form action={gendanBackup} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="filnavn">Kopi der skal lægges tilbage</Label>
                <Select id="filnavn" name="filnavn" defaultValue={nyeste?.filnavn}>
                  {backups.map((b) => (
                    <option key={b.filnavn} value={b.filnavn}>
                      {tidspunkt(b.tid)}
                      {b === nyeste ? " — nyeste" : ""}
                      {b.af ? ` · ${navne.get(b.af) ?? b.af}` : ""}
                      {` · ${filstoerrelse(b.bytes)}`}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Den nyeste er valgt på forhånd.
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" name="bekraeft" className="mt-0.5 h-4 w-4 rounded border-input accent-[hsl(var(--primary))]" />
                <span>
                  Ja, overskriv den nuværende database
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Alt der er skrevet ind efter den valgte kopi blev taget, forsvinder. Sørg for at hverken du eller en
                    kollega har programmet åbent andre steder — Windows låser filen.
                  </span>
                </span>
              </label>

              <div className="flex justify-end"><Button type="submit" variant="danger">Gendan</Button></div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card className="border-warning/40">
        <CardHeader
          title={<span className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-warning" />Hvis I skal være flere om den samme database</span>}
        />
        <CardBody className="text-sm text-muted-foreground flex flex-col gap-2.5 leading-relaxed">
          <p>
            SQLite er én fil, og den fil er ikke bygget til at blive skrevet i fra flere maskiner samtidig.
            Låsemekanismen bygger på fillåse, som ikke opfører sig pålideligt over SMB. To personer der gemmer
            på samme tid kan ødelægge filen.
          </p>
          <p>
            <b className="text-foreground">Aldrig i en synkroniseret mappe.</b> OneDrive, SharePoint, Dropbox og
            lignende kopierer filen mens den skrives. Det ender med en halv transaktion eller to versioner der
            hver mangler noget.
          </p>
          <p>
            <b className="text-foreground">Den sikre vej til flere brugere:</b> lad programmet køre på én maskine
            og lad de andre åbne adressen i deres browser. Så er der stadig kun én der rører databasen, og alle
            ser det samme. Appen er allerede en webserver — det kræver kun at maskinen står tændt.
          </p>
          <p>
            <b className="text-foreground">Tag kopier.</b> Luk programmet og kopiér .db-filen. Det er hele
            sikkerhedskopien, logo og brugere inklusive.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Raek({ label, vaerdi }: { label: string; vaerdi: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right min-w-0">{vaerdi}</span>
    </div>
  );
}
