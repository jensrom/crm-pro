"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { kraevSuperAdmin } from "@/lib/auth";
import { bygDemomiljoe } from "@/lib/demomiljoe";

/**
 * Fiktive demosager — salgsmuligheder, teknik-sager, notater og logbogsposter
 * spredt ud over de eksisterende kunder, så alle tavler og lister har noget at vise.
 *
 * Alt demodata får et id der starter med "demo_". Derfor kan det fjernes igen
 * præcist, uden at røre ved rigtige data.
 */

const DAG = 86_400_000;
const PRAEFIKS = "demo_";
let taeller = 0;
const id = () => `${PRAEFIKS}${Date.now().toString(36)}${(taeller++).toString(36).padStart(4, "0")}`;
const dageSiden = (n: number) => new Date(Date.now() - n * DAG);
const omDage = (n: number) => new Date(Date.now() + n * DAG);

type SagSkabelon = {
  title: string;
  stage: string;
  seats: number;
  /** dage siden oprettelse */
  oprettet: number;
  /** dage i nuværende stadie */
  iStadie: number;
  /** dage til forventet luk (negativ = overskredet) */
  luk?: number;
  nextStep?: string;
  notes?: string;
  lostReason?: string;
  /** stadier sagen har været igennem, til logbogen */
  rejse: string[];
};

const SALG: SagSkabelon[] = [
  // Leads
  { title: "Spurgte til flere brugere på lageret", stage: "ny", seats: 3, oprettet: 2, iStadie: 2, nextStep: "Ring til driftschefen", rejse: ["ny"] },
  { title: "Ny vedligeholdelsesleder starter i november", stage: "ny", seats: 2, oprettet: 6, iStadie: 6, nextStep: "Book introduktionsmøde", rejse: ["ny"] },
  { title: "Interesse for mobil-app til teknikere", stage: "ny", seats: 4, oprettet: 12, iStadie: 12, rejse: ["ny"] },
  { title: "Søsterselskab overvejer samme løsning", stage: "ny", seats: 8, oprettet: 37, iStadie: 37, nextStep: "Få navn på kontakt i søsterselskabet", rejse: ["ny"] },
  { title: "Nævnte budget til 2027 på kundemøde", stage: "ny", seats: 2, oprettet: 1, iStadie: 1, rejse: ["ny"] },
  { title: "Vil se reservedelsmodulet", stage: "ny", seats: 1, oprettet: 9, iStadie: 9, nextStep: "Send demo-video", rejse: ["ny"] },
  // Kvalificeret
  { title: "Udvidelse med 5 brugere til ny produktionslinje", stage: "kvalificeret", seats: 5, oprettet: 21, iStadie: 8, luk: 30, nextStep: "Afklar opstartsdato for linje 3", rejse: ["ny", "kvalificeret"] },
  { title: "Opgradering fra Small til Medium", stage: "kvalificeret", seats: 6, oprettet: 18, iStadie: 4, luk: 45, nextStep: "Gennemgå forskel på pakkerne med IT", rejse: ["ny", "kvalificeret"] },
  { title: "Tilkøb af planlægningsbrugere", stage: "kvalificeret", seats: 2, oprettet: 40, iStadie: 33, luk: 14, nextStep: "Følg op — har ligget længe", rejse: ["ny", "kvalificeret"] },
  { title: "Ekstra site i Sønderborg", stage: "kvalificeret", seats: 7, oprettet: 15, iStadie: 3, luk: 60, rejse: ["ny", "kvalificeret"] },
  // Tilbud sendt
  { title: "Tilbud på 4 ekstra licenser", stage: "tilbud", seats: 4, oprettet: 30, iStadie: 6, luk: 10, nextStep: "Ring fredag hvis intet svar", rejse: ["ny", "kvalificeret", "tilbud"] },
  { title: "Medium-pakke til hele vedligehold", stage: "tilbud", seats: 10, oprettet: 45, iStadie: 12, luk: -3, nextStep: "Tilbud udløber — forlæng eller luk", rejse: ["ny", "kvalificeret", "tilbud"] },
  { title: "Licenser til vinterhold", stage: "tilbud", seats: 3, oprettet: 20, iStadie: 2, luk: 21, rejse: ["ny", "kvalificeret", "tilbud"] },
  // Forhandling
  { title: "Rammeaftale 3 år med prisgaranti", stage: "forhandling", seats: 12, oprettet: 60, iStadie: 9, luk: 7, nextStep: "Juridisk gennemgang hos kunden", notes: "Kunden ønsker 36 mdr. binding mod fast pris.", rejse: ["ny", "kvalificeret", "tilbud", "forhandling"] },
  { title: "Opgradering til Large inkl. API", stage: "forhandling", seats: 5, oprettet: 50, iStadie: 4, luk: 14, nextStep: "Afvent indkøbs godkendelse", rejse: ["ny", "kvalificeret", "tilbud", "forhandling"] },
  // Afsluttet — står på boardet en tid
  { title: "2 ekstra licenser til ny tekniker", stage: "vundet", seats: 2, oprettet: 25, iStadie: 3, rejse: ["ny", "kvalificeret", "tilbud", "vundet"] },
  { title: "Opgradering til Medium", stage: "vundet", seats: 6, oprettet: 70, iStadie: 9, rejse: ["ny", "kvalificeret", "tilbud", "forhandling", "vundet"] },
  { title: "Udvidelse til værksted", stage: "tabt", seats: 3, oprettet: 35, iStadie: 5, lostReason: "Budgettet blev skåret i år", rejse: ["ny", "kvalificeret", "tilbud", "tabt"] },
  // Afsluttet for længe siden — ryddet væk, men kan vises
  { title: "Licenser til projektafdeling", stage: "vundet", seats: 4, oprettet: 120, iStadie: 45, rejse: ["ny", "kvalificeret", "tilbud", "vundet"] },
  { title: "Skift til konkurrent overvejet", stage: "tabt", seats: 5, oprettet: 150, iStadie: 60, lostReason: "Valgte at blive på nuværende pakke", rejse: ["ny", "kvalificeret", "tabt"] },
];

const STADIENAVN: Record<string, string> = {
  ny: "Lead", kvalificeret: "Kvalificeret", tilbud: "Tilbud sendt", forhandling: "Forhandling", vundet: "Vundet", tabt: "Tabt",
};
const SANDSYNLIGHED: Record<string, number> = { ny: 10, kvalificeret: 25, tilbud: 50, forhandling: 75, vundet: 100, tabt: 0 };

type TeknikSkabelon = {
  title: string;
  description: string;
  status: string;
  priority: string;
  oprettet: number;
  frist?: number;
  lukket?: number;
};

const TEKNIK: TeknikSkabelon[] = [
  { title: "Kan ikke logge ind efter skift af kodeord", description: "Brugeren får 'ugyldigt login' efter nulstilling.", status: "aaben", priority: "hoej", oprettet: 1, frist: 1 },
  { title: "Arbejdsordrer vises dobbelt i oversigten", description: "Gælder kun filteret 'Mine ordrer'.", status: "aaben", priority: "normal", oprettet: 4, frist: 5 },
  { title: "Import af aktiver fra Excel fejler", description: "Fejl ved kolonnen 'Placering' — ca. 340 rækker.", status: "aaben", priority: "kritisk", oprettet: 2, frist: -1 },
  { title: "Ønske om nyt felt på arbejdsordren", description: "Feltet 'Stopårsag' som dropdown.", status: "afventer_kunde", priority: "lav", oprettet: 14 },
  { title: "Rapport over planlagt vedligehold mangler data", description: "Uge 40 og 41 er tomme i rapporten.", status: "aaben", priority: "normal", oprettet: 7, frist: 3 },
  { title: "Mobil-app synkroniserer langsomt", description: "Op til 5 min. før ændringer ses på pc.", status: "afventer_leverandoer", priority: "hoej", oprettet: 10, frist: 4 },
  { title: "Oprettelse af 3 nye brugere", description: "Navne og roller sendt på mail.", status: "aaben", priority: "lav", oprettet: 1 },
  { title: "Forkert sprog i mails til teknikere", description: "Notifikationer kommer på engelsk.", status: "afventer_kunde", priority: "normal", oprettet: 20 },
  { title: "Reservedelslager viser negativ beholdning", description: "Varenr. 10-2231 står med −4.", status: "aaben", priority: "hoej", oprettet: 3, frist: 2 },
  { title: "Kursus i planlægningsmodulet", description: "To superbrugere, gerne i november.", status: "aaben", priority: "lav", oprettet: 9 },
  // Løst/lukket
  { title: "Printeropsætning til arbejdsordrer", description: "Løst via fjernsupport.", status: "loest", priority: "normal", oprettet: 12, lukket: 3 },
  { title: "Nulstil 2FA for vedligeholdelseschef", description: "Udført.", status: "lukket", priority: "hoej", oprettet: 8, lukket: 6 },
  { title: "Fejl i timeregistrering ved midnat", description: "Rettet i opdatering.", status: "loest", priority: "normal", oprettet: 30, lukket: 10 },
  { title: "Gammel sag om eksport til CSV", description: "Lukket efter aftale.", status: "lukket", priority: "lav", oprettet: 90, lukket: 60 },
];

type NotatSkabelon = { title: string; track: "salg" | "teknik"; lane: string; priority: string; frist?: number };

const NOTATER: NotatSkabelon[] = [
  { title: "Send referat fra statusmøde", track: "salg", lane: "nu", priority: "hoej", frist: 1 },
  { title: "Forbered fornyelse til januar", track: "salg", lane: "naeste", priority: "normal", frist: 30 },
  { title: "Spørg ind til tilfredshed efter opgradering", track: "salg", lane: "naeste", priority: "normal" },
  { title: "Afventer underskrift på tilbud", track: "salg", lane: "venter", priority: "normal" },
  { title: "Inviter til brugerdag", track: "salg", lane: "faerdig", priority: "lav" },
  { title: "Tjek backup-job efter opdatering", track: "teknik", lane: "nu", priority: "hoej", frist: -1 },
  { title: "Planlæg fjernsession med IT", track: "teknik", lane: "naeste", priority: "normal", frist: 5 },
  { title: "Venter på logfiler fra kunden", track: "teknik", lane: "venter", priority: "normal" },
  { title: "Opdater dokumentation for integration", track: "teknik", lane: "naeste", priority: "lav" },
  { title: "Gennemgå brugerrettigheder", track: "teknik", lane: "faerdig", priority: "normal" },
];

export async function indlaesDemodata() {
  const mig = await kraevSuperAdmin();

  await fjernAlt();

  const [kunder, produkter, sidsteSag] = await Promise.all([
    db.company.findMany({ where: { isActive: true }, select: { id: true }, orderBy: { name: "asc" } }),
    db.product.findMany({
      where: { isActive: true, licenseModel: { not: "fee" }, pricePerUserMonth: { not: null } },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.ticket.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
  ]);
  if (kunder.length === 0) redirect("/indstillinger?demo=ingen-kunder");

  // Spred over kunderne med et fast spring, så det ikke klumper sig på de første.
  const kunde = (i: number, spring: number) => kunder[(i * spring) % kunder.length].id;
  const produkt = (i: number) => (produkter.length ? produkter[i % produkter.length].id : null);

  const deals: any[] = [];
  const log: any[] = [];

  SALG.forEach((s, i) => {
    const companyId = kunde(i, 7);
    const dealId = id();
    const afsluttet = s.stage === "vundet" || s.stage === "tabt";
    deals.push({
      id: dealId,
      companyId,
      productId: produkt(i),
      title: s.title,
      seatDelta: s.seats,
      stage: s.stage,
      probability: SANDSYNLIGHED[s.stage],
      expectedCloseDate: s.luk != null ? omDage(s.luk) : null,
      closedAt: afsluttet ? dageSiden(s.iStadie) : null,
      stageChangedAt: dageSiden(s.iStadie),
      nextStep: s.nextStep ?? null,
      notes: s.notes ?? null,
      lostReason: s.lostReason ?? null,
      createdAt: dageSiden(s.oprettet),
    });

    // Logbogen: oprettelse og hvert stadieskift, fordelt mellem oprettelse og nu.
    log.push({ id: id(), companyId, kind: "salg", content: `Ny salgsmulighed: ${s.title} (Lead)`, author: mig.initials, createdAt: dageSiden(s.oprettet) });
    for (let t = 1; t < s.rejse.length; t++) {
      const sidste = t === s.rejse.length - 1;
      const dage = sidste ? s.iStadie : Math.round(s.oprettet - ((s.oprettet - s.iStadie) * t) / (s.rejse.length - 1));
      log.push({
        id: id(),
        companyId,
        kind: "salg",
        content: `${s.title}: ${STADIENAVN[s.rejse[t - 1]]} → ${STADIENAVN[s.rejse[t]]}`,
        author: mig.initials,
        createdAt: dageSiden(dage),
      });
    }
  });

  let nummer = sidsteSag?.number ?? 0;
  const tickets = TEKNIK.map((t, i) => ({
    id: id(),
    number: ++nummer,
    companyId: kunde(i, 5),
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.frist != null ? omDage(t.frist) : null,
    resolvedAt: t.lukket != null ? dageSiden(t.lukket) : null,
    closedAt: t.lukket != null && t.status === "lukket" ? dageSiden(t.lukket) : null,
    createdAt: dageSiden(t.oprettet),
  }));

  const notes = NOTATER.map((n, i) => ({
    id: id(),
    companyId: kunde(i, 3),
    title: n.title,
    track: n.track,
    lane: n.lane,
    position: -1000 + i,
    priority: n.priority,
    dueAt: n.frist != null ? omDage(n.frist) : null,
    completedAt: n.lane === "faerdig" ? dageSiden(2) : null,
    author: mig.initials,
  }));

  await db.$transaction([
    db.deal.createMany({ data: deals }),
    db.ticket.createMany({ data: tickets }),
    db.customerNote.createMany({ data: notes }),
    db.logEntry.createMany({ data: log }),
  ]);

  opfrisk();
  redirect(`/indstillinger?demo=indlaest&antal=${deals.length + tickets.length + notes.length}`);
}

export async function fjernDemodata() {
  await kraevSuperAdmin();
  await fjernAlt();
  opfrisk();
  redirect("/indstillinger?demo=fjernet");
}

async function fjernAlt() {
  const hvor = { id: { startsWith: PRAEFIKS } };
  // Er der registreret tid fra et rigtigt klippekort på en demosag, forsvinder
  // tidsposten med sagen — så kortets forbrug skal regnes forfra bagefter.
  const kort = await db.timeLog.findMany({
    where: { ticketId: { startsWith: PRAEFIKS }, bundleId: { not: null } },
    select: { bundleId: true },
    distinct: ["bundleId"],
  });
  await db.$transaction([
    db.logEntry.deleteMany({ where: hvor }),
    db.customerNote.deleteMany({ where: hvor }),
    db.ticket.deleteMany({ where: hvor }),
    db.deal.deleteMany({ where: hvor }),
  ]);
  for (const { bundleId } of kort) {
    if (!bundleId) continue;
    const sum = await db.timeLog.aggregate({ where: { bundleId }, _sum: { durationMin: true } });
    await db.hourBundle.update({ where: { id: bundleId }, data: { usedMinutes: sum._sum.durationMin ?? 0 } });
  }
}

/** Antal demoposter der ligger i databasen lige nu. */
export async function taelDemodata() {
  const hvor = { id: { startsWith: PRAEFIKS } };
  const [d, t, n] = await Promise.all([
    db.deal.count({ where: hvor }),
    db.ticket.count({ where: hvor }),
    db.customerNote.count({ where: hvor }),
  ]);
  return d + t + n;
}

function opfrisk() {
  revalidatePath("/", "layout");
}

/**
 * Sletter alle kunder og bygger demomiljøet op fra bunden (lib/demomiljoe.ts).
 * Kræver at brugeren har sat flueben ved, at backuppen er hentet.
 */
export async function bygDemomiljoeHandling(formData: FormData) {
  const mig = await kraevSuperAdmin();
  if (formData.get("backup") !== "1") redirect("/indstillinger?demo=backup#demomiljoe");
  const r = await bygDemomiljoe(mig.initials);
  opfrisk();
  redirect(`/indstillinger?demo=bygget&antal=${r.kunder}&produkter=${r.produkter}&licenser=${r.licenser}#demomiljoe`);
}
