import "server-only";
import { db } from "@/lib/db";
import { naesteSubNummer } from "@/lib/kontrakter";
import { aftaleUdloeb, maanederMellem, plusDage, slutFraMaaneder } from "@/lib/perioder";
import { ordrePdf } from "@/lib/ordre-pdf";
import { gemDokumentIFilboks } from "@/lib/filer";
import { dokNr, hentAfsender, subNr } from "@/lib/dokumenter";
import { lavImplementeringsplan, lavKontrakt, lavMailudskrift, lavMoedereferat, type KontraktLinje } from "@/lib/pdf";

/**
 * Demomiljø: sletter alle kunder og alt der hænger på dem og bygger 6 nye,
 * fuldt udfyldte kunder op fra bunden — mindst to af alt på hver kunde, og
 * aldrig to ens. Brugere, indstillinger og eksisterende licenser (fx Idus)
 * røres ikke. Demoens egne produkter har id'er der starter med "dm-", så de
 * kan bygges om igen ved næste kørsel.
 */

const DAG = 86_400_000;
const PRAEFIKS = "dm-";

// ---------- Tilfældighed (ny hver kørsel, men styret så intet går igen) ----------

function lavRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Terning {
  constructor(private r: () => number) {}
  tal(min: number, max: number) {
    return Math.floor(this.r() * (max - min + 1)) + min;
  }
  en<T>(liste: readonly T[]): T {
    return liste[Math.floor(this.r() * liste.length)];
  }
  chance(p: number) {
    return this.r() < p;
  }
  bland<T>(liste: readonly T[]): T[] {
    const a = [...liste];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** n forskellige elementer */
  nogle<T>(liste: readonly T[], n: number): T[] {
    return this.bland(liste).slice(0, Math.min(n, liste.length));
  }
}

/**
 * Trækker uden tilbagelægning — så to kunder ikke får samme navn, sag osv.
 * Er puljen brugt op, blandes den igen (sker kun for de små lister).
 */
class Pulje<T> {
  private rest: T[];
  constructor(private t: Terning, private liste: readonly T[]) {
    this.rest = t.bland(liste);
  }
  tag(): T {
    if (!this.rest.length) this.rest = this.t.bland(this.liste);
    return this.rest.pop() as T;
  }
}

const dageSiden = (n: number) => new Date(Date.now() - n * DAG);
const omDage = (n: number) => new Date(Date.now() + n * DAG);
const middag = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

// ---------- Katalog: 8 fiktive produkter ved siden af Idus ----------

type LicensSkabelon = {
  id: string;
  name: string;
  model: "sub" | "perpetual" | "fee";
  /** sub: pr. bruger pr. md. — perpetual/fee: engangspris */
  pris: number;
  /** Pris for et år siden (prishistorik) */
  tidligere: number;
  tier: string;
  icon: string;
  color: string;
  tekst: string;
};

type ProduktSkabelon = {
  id: string;
  name: string;
  description: string;
  terms: string;
  licenser: LicensSkabelon[];
};

const BETALING = "Betaling: 14 dage netto\nFakturering: Årligt forud for abonnementer, ved levering for engangskøb\nPriser: Ekskl. moms";

const KATALOG: ProduktSkabelon[] = [
  {
    id: "dm-fam-vektor",
    name: "Vektor Asset",
    description: "Aktivregister og levetidsøkonomi for produktionsudstyr.",
    terms: `${BETALING}\nOpsigelse: 3 måneder før udløb`,
    licenser: [
      { id: "dm-vektor-basis", name: "Vektor Asset Basis", model: "sub", pris: 290, tidligere: 265, tier: "small", icon: "layers", color: "blaa", tekst: "Aktivregister, stamdata og QR-mærkning. Pr. navngiven bruger pr. måned." },
      { id: "dm-vektor-pro", name: "Vektor Asset Pro", model: "sub", pris: 485, tidligere: 450, tier: "medium", icon: "layers", color: "lilla", tekst: "Alt i Basis samt levetidsberegning, budget og rapporter." },
      { id: "dm-vektor-server", name: "Vektor Server-licens", model: "perpetual", pris: 18500, tidligere: 17200, tier: "server", icon: "boxes", color: "graa", tekst: "Evig licens til on-premise installation. Opdateringer kræver serviceaftale." },
    ],
  },
  {
    id: "dm-fam-pulsar",
    name: "Pulsar Monitor",
    description: "Tilstandsovervågning med trådløse sensorer og alarmer.",
    terms: `${BETALING}\nHardware: Sensorer leveres separat og ejes af kunden`,
    licenser: [
      { id: "dm-pulsar-standard", name: "Pulsar Monitor Standard", model: "sub", pris: 380, tidligere: 360, tier: "medium", icon: "zap", color: "groen", tekst: "Dashboards, alarmer og trendanalyse for op til 50 målepunkter pr. bruger." },
      { id: "dm-pulsar-gateway", name: "Pulsar Gateway-licens", model: "perpetual", pris: 12900, tidligere: 12900, tier: "gateway", icon: "shield", color: "groen", tekst: "Evig licens pr. gateway. Én gateway dækker typisk én produktionshal." },
      { id: "dm-pulsar-opsaetning", name: "Sensoropsætning pr. hal", model: "fee", pris: 4500, tidligere: 4200, tier: "ydelse", icon: "briefcase", color: "graa", tekst: "Montering, parring og test af sensorer i én hal. Ekskl. kørsel." },
    ],
  },
  {
    id: "dm-fam-lagerfyr",
    name: "Lagerfyr",
    description: "Reservedelslager med genbestilling og stregkoder.",
    terms: BETALING,
    licenser: [
      { id: "dm-lagerfyr-cloud", name: "Lagerfyr Cloud", model: "sub", pris: 240, tidligere: 225, tier: "small", icon: "package", color: "bronze", tekst: "Lagerstyring, minimumsbeholdning og indkøbsforslag. Pr. bruger pr. måned." },
      { id: "dm-lagerfyr-desktop", name: "Lagerfyr Desktop", model: "perpetual", pris: 7800, tidligere: 7400, tier: "desktop", icon: "box", color: "bronze", tekst: "Evig licens pr. arbejdsstation inkl. stregkodeskanner-driver." },
    ],
  },
  {
    id: "dm-fam-planbro",
    name: "Planbro",
    description: "Ressource- og stopplanlægning for vedligeholdsteams.",
    terms: `${BETALING}\nBinding: Følger aftaleperioden`,
    licenser: [
      { id: "dm-planbro-planner", name: "Planbro Planner", model: "sub", pris: 420, tidligere: 395, tier: "medium", icon: "star", color: "blaa", tekst: "Ugeplan, kapacitet og træk-og-slip af arbejdsordrer." },
      { id: "dm-planbro-plus", name: "Planbro Planner+", model: "sub", pris: 640, tidligere: 610, tier: "large", icon: "crown", color: "guld", tekst: "Alt i Planner samt stopplanlægning, scenarier og Gantt-eksport." },
    ],
  },
  {
    id: "dm-fam-rundtur",
    name: "Rundtur Mobile",
    description: "Mobil rundering og smøreruter med offline-tilstand.",
    terms: BETALING,
    licenser: [
      { id: "dm-rundtur-app", name: "Rundtur Mobile", model: "sub", pris: 180, tidligere: 165, tier: "small", icon: "rocket", color: "roed", tekst: "App til iOS og Android. Ruter, målinger og fotos, også uden dækning." },
      { id: "dm-rundtur-rute", name: "Ruteopsætning", model: "fee", pris: 6500, tidligere: 6000, tier: "ydelse", icon: "briefcase", color: "roed", tekst: "Opsætning af op til 10 ruter med målepunkter og intervaller." },
    ],
  },
  {
    id: "dm-fam-dokumentdok",
    name: "Dokumentdok",
    description: "Tegninger, manualer og certifikater samlet på aktivet.",
    terms: `${BETALING}\nLagerplads: 500 GB inkluderet`,
    licenser: [
      { id: "dm-dokdok-cloud", name: "Dokumentdok Cloud", model: "sub", pris: 150, tidligere: 150, tier: "small", icon: "sparkles", color: "lilla", tekst: "Versionsstyring, søgning og deling. Pr. bruger pr. måned." },
      { id: "dm-dokdok-site", name: "Dokumentdok Site-licens", model: "perpetual", pris: 24000, tidligere: 22500, tier: "site", icon: "gem", color: "lilla", tekst: "Evig licens for ét site med ubegrænset antal læsebrugere." },
    ],
  },
  {
    id: "dm-fam-energispor",
    name: "Energispor",
    description: "Energiovervågning pr. maskine og linje.",
    terms: BETALING,
    licenser: [
      { id: "dm-energi-analyse", name: "Energispor Analyse", model: "sub", pris: 310, tidligere: 295, tier: "medium", icon: "zap", color: "guld", tekst: "Forbrug pr. aktiv, CO₂-rapport og afvigelsesalarmer." },
      { id: "dm-energi-adapter", name: "Måleradapter-licens", model: "perpetual", pris: 3200, tidligere: 2950, tier: "adapter", icon: "diamond", color: "guld", tekst: "Evig licens pr. tilsluttet måler (Modbus/M-Bus)." },
    ],
  },
  {
    id: "dm-fam-ydelser",
    name: "Konsulentydelser",
    description: "Implementering, kurser, rejser og projektledelse.",
    terms: "Betaling: 14 dage netto\nFakturering: Månedligt bagud efter forbrug\nRejsetid: Faktureres med 50 %",
    licenser: [
      { id: "dm-ydelse-implementering", name: "Implementeringsdag", model: "fee", pris: 9800, tidligere: 9400, tier: "ydelse", icon: "briefcase", color: "graa", tekst: "Konsulent på stedet, 7,5 timer inkl. forberedelse." },
      { id: "dm-ydelse-kursus", name: "Kursus pr. deltager", model: "fee", pris: 2400, tidligere: 2250, tier: "ydelse", icon: "award", color: "blaa", tekst: "Heldagskursus med materiale og frokost." },
      { id: "dm-ydelse-rejse", name: "Rejse og kørsel", model: "fee", pris: 1250, tidligere: 1150, tier: "ydelse", icon: "rocket", color: "graa", tekst: "Fast tillæg pr. besøg inden for Danmark. Færøerne faktureres efter regning." },
      { id: "dm-ydelse-projektledelse", name: "Projektledelse pr. time", model: "fee", pris: 1150, tidligere: 1095, tier: "ydelse", icon: "briefcase", color: "soelv", tekst: "Styregruppemøder, plan og opfølgning." },
      { id: "dm-ydelse-migrering", name: "Datamigrering", model: "fee", pris: 14000, tidligere: 13500, tier: "ydelse", icon: "boxes", color: "soelv", tekst: "Udtræk, vask og indlæsning af stamdata fra tidligere system." },
      { id: "dm-ydelse-integration", name: "Integration (API)", model: "fee", pris: 22000, tidligere: 21000, tier: "ydelse", icon: "layers", color: "soelv", tekst: "Opsætning af integration til ERP eller lønsystem, inkl. test." },
    ],
  },
];

// ---------- Kunder: 6 forskellige profiler ----------

type KundeProfil = {
  forled: string;
  efterled: string;
  branche: string;
  land: "Danmark" | "Færøerne";
  by: string;
  postnr: string;
  vej: string;
};

const KUNDER: KundeProfil[] = [
  { forled: "Kragholm", efterled: "Fødevarer A/S", branche: "Food & Beverage", land: "Danmark", by: "Vejle", postnr: "7100", vej: "Havnegade" },
  { forled: "Østerhede", efterled: "Maskinfabrik A/S", branche: "Manufacturing", land: "Danmark", by: "Herning", postnr: "7400", vej: "Industrivej" },
  { forled: "Tórshavn Havn", efterled: "P/F", branche: "Logistics", land: "Færøerne", by: "Tórshavn", postnr: "100", vej: "Bryggjubakki" },
  { forled: "Lindbæk", efterled: "Forsyning A/S", branche: "Utilities", land: "Danmark", by: "Skive", postnr: "7800", vej: "Værkstedsvej" },
  { forled: "Sjøvík", efterled: "Fiskavirki P/F", branche: "Food & Beverage", land: "Færøerne", by: "Klaksvík", postnr: "700", vej: "Klaksvíksvegur" },
  { forled: "Marselis", efterled: "Plast ApS", branche: "Manufacturing", land: "Danmark", by: "Aarhus N", postnr: "8200", vej: "Agro Allé" },
  { forled: "Grenåsen", efterled: "Pharma A/S", branche: "Life Science", land: "Danmark", by: "Kalundborg", postnr: "4400", vej: "Hjortholmsvej" },
  { forled: "Brændkær", efterled: "Mejeri A/S", branche: "Food & Beverage", land: "Danmark", by: "Kolding", postnr: "6000", vej: "Mejerivej" },
];

const FORNAVNE = ["Anne", "Mads", "Signe", "Rasmus", "Louise", "Jonas", "Camilla", "Frederik", "Mette", "Kasper", "Ida", "Thomas", "Sofie", "Nikolaj", "Helle", "Emil", "Rakul", "Jógvan", "Sunneva", "Bárður", "Tina", "Morten", "Lene", "Søren"];
const EFTERNAVNE = ["Holm", "Kjær", "Bundgaard", "Lauridsen", "Vestergaard", "Thygesen", "Dahl", "Mikkelsen", "Juul", "Brandt", "Poulsen", "Hansen", "Joensen", "Dam", "Petersen", "Skov", "Lund", "Winther", "Rask", "Iversen"];
const TITLER = ["Vedligeholdelseschef", "Driftschef", "Teknisk direktør", "Indkøbschef", "IT-ansvarlig", "Planlægger", "Produktionschef", "Superbruger", "CFO", "Fabrikschef", "Energiansvarlig", "Lagerchef"];
const ROLLER = ["beslutningstager", "budgetansvarlig", "influencer", "ambassadoer", ""];
const STATUS = ["glad", "stabil", "opmaerksomhed", "problemer", "risiko", "stabil", "glad"];
const STATUSNOTE: Record<string, string> = {
  glad: "Rost implementeringen på sidste statusmøde.",
  stabil: "Kører uden større henvendelser.",
  opmaerksomhed: "Ny driftschef — relationen skal bygges op igen.",
  problemer: "Utilfreds med svartider på supporten i september.",
  risiko: "Har bedt om tilbud fra konkurrent til fornyelsen.",
};

const SALGSSAGER = [
  "Udvidelse til ny produktionslinje", "Opgradering til Pro-pakken", "Tilkøb af mobilbrugere", "Rammeaftale 36 mdr.",
  "Energiovervågning på kompressorer", "Reservedelslager på nyt site", "Kursus for nye superbrugere", "Stopplanlægning til sommerstop",
  "Integration til ERP", "Dokumentstyring til certifikater", "Sensorer på pumper", "Licenser til vinterhold", "Skift fra perpetual til abonnement",
  "Gateway til hal 2", "Planbro til projektafdelingen", "Rundering på vandværkerne", "Site-licens til nyt lager",
  "Flytning af data fra gammelt system", "Opgradering af gateways", "Pilot på energimåling",
];
const STADIER_FORLOEB = ["ny", "kvalificeret", "tilbud", "forhandling", "vundet", "tabt"] as const;
const SANDSYNLIGHED: Record<string, number> = { ny: 10, kvalificeret: 25, tilbud: 50, forhandling: 75, vundet: 100, tabt: 0 };
const NAESTE_SKRIDT = ["Ring til driftschefen", "Send revideret tilbud", "Book demo med IT", "Afvent budgetgodkendelse", "Få navn på beslutningstager", "Følg op efter ferien", "Send referencecase"];
const TABT_AARSAG = ["Budgettet blev skåret", "Valgte konkurrent på pris", "Projektet blev udskudt til 2027"];

const AKTIVITETER: { type: string; subject: string }[] = [
  { type: "moede", subject: "Statusmøde med driften" },
  { type: "opkald", subject: "Opfølgning på tilbud" },
  { type: "mail", subject: "Send prisoverslag" },
  { type: "opgave", subject: "Forbered fornyelse" },
  { type: "opfoelgning", subject: "Tjek tilfredshed efter kursus" },
  { type: "moede", subject: "Workshop om stopplanlægning" },
  { type: "opkald", subject: "Afklar antal brugere" },
  { type: "note", subject: "Kunden overvejer site nr. 2" },
  { type: "mail", subject: "Fremsend referencecase" },
  { type: "opgave", subject: "Opdatér kontaktliste" },
];

const SAGER: { title: string; description: string }[] = [
  { title: "Login fejler efter skift af kodeord", description: "Brugeren får 'ugyldigt login' efter nulstilling." },
  { title: "Sensoralarmer kommer dobbelt", description: "Samme alarm sendes to gange med 1 minuts mellemrum." },
  { title: "Import af aktiver fejler på kolonnen Placering", description: "Ca. 300 rækker afvises ved import." },
  { title: "Mobil-app synkroniserer langsomt", description: "Op til 5 minutter før ændringer ses på pc." },
  { title: "Rapport over energiforbrug mangler uge 41", description: "Grafen er tom for hele ugen." },
  { title: "Ønske om nyt felt på arbejdsordren", description: "Feltet 'Stopårsag' som rulleliste." },
  { title: "Gateway mister forbindelsen om natten", description: "Falder ud ca. kl. 02 og kommer først igen ved genstart." },
  { title: "Forkert sprog i mails til teknikere", description: "Notifikationer kommer på engelsk." },
  { title: "Negativ beholdning på reservedel", description: "Varenr. 10-2231 står med −4." },
  { title: "Oprettelse af tre nye brugere", description: "Navne og roller sendt på mail." },
  { title: "Planbro viser forkert kapacitet", description: "Helligdage regnes som arbejdsdage." },
  { title: "Dokumenter kan ikke åbnes på iPad", description: "PDF'er over 20 MB loader ikke." },
  { title: "Ruter vises ikke i mobil-appen", description: "Nye ruter fra i går er ikke kommet ud på telefonerne." },
  { title: "Fejl i CO₂-rapporten", description: "Faktoren for fjernvarme er den gamle." },
  { title: "Ønske om SSO med Microsoft", description: "IT vil have login via Entra ID." },
  { title: "Prisregulering slået forkert igennem", description: "Fakturaen viser gammel pris på to licenser." },
  { title: "Stregkodeskanner læser ikke nye etiketter", description: "Gælder kun etiketter fra den nye printer." },
  { title: "Kursusønske til to nye planlæggere", description: "Gerne i uge 48." },
];
const SAGSKOMMENTARER = [
  "Reproduceret i testmiljøet.", "Kunden har sendt skærmbilleder.", "Sendt videre til udvikling med logfiler.",
  "Midlertidig løsning givet — genstart af tjenesten.", "Rettelse kommer i næste version.", "Kunden bekræfter at det virker igen.",
  "Afventer svar fra kundens IT.", "Fjernsession aftalt torsdag kl. 10.", "Intern: kendt fejl, se sag om samme emne.",
];

const NOTATER = [
  { title: "Send referat fra statusmøde", track: "salg" }, { title: "Forbered fornyelse", track: "salg" },
  { title: "Spørg ind til site nr. 2", track: "salg" }, { title: "Inviter til brugerdag", track: "salg" },
  { title: "Tjek backup efter opdatering", track: "teknik" }, { title: "Planlæg fjernsession med IT", track: "teknik" },
  { title: "Venter på logfiler fra kunden", track: "teknik" }, { title: "Gennemgå brugerrettigheder", track: "teknik" },
];
const LOGTEKSTER: { kind: string; content: string }[] = [
  { kind: "moede", content: "Statusmøde: driften er tilfreds, ønsker flere mobilbrugere til foråret." },
  { kind: "opkald", content: "Ringede om fakturering — ønsker kvartalsvis i stedet for årligt." },
  { kind: "mail", content: "Sendt prisliste for 2027 og vilkår for flerårsaftale." },
  { kind: "note", content: "Ny vedligeholdelseschef starter 1. december." },
  { kind: "advarsel", content: "Kritisk sag åben i over en uge — hold øje med stemningen." },
  { kind: "aftale", content: "Aftalt pilot på sensorer i hal 1 i tre måneder." },
  { kind: "moede", content: "Workshop om stopplanlægning med fire superbrugere." },
  { kind: "opkald", content: "Kunden spurgte til integration til deres ERP." },
];

// ---------- PDF-bilag ----------

async function gemBilag(companyId: string, filename: string, category: string, bytes: Uint8Array, af: string | null, dato: Date) {
  await db.attachment.create({
    data: { companyId, filename, category, mimeType: "application/pdf", sizeBytes: bytes.byteLength, data: Buffer.from(bytes), uploadedBy: af, createdAt: dato },
  });
}

// ---------- Sletning ----------

/** Fjerner alle kunder og alt der hænger på dem, samt demoens egne produkter fra en tidligere kørsel. */
async function rydAlt() {
  await db.$transaction([
    db.order.deleteMany({}),
    db.timeLog.deleteMany({}),
    db.ticket.deleteMany({}),
    db.hourBundle.deleteMany({}),
    db.activity.deleteMany({}),
    db.deal.deleteMany({}),
    db.customerNote.deleteMany({}),
    db.logEntry.deleteMany({}),
    db.attachment.deleteMany({}),
    db.licenseChange.deleteMany({}),
    db.customerProduct.deleteMany({}),
    db.contract.deleteMany({}),
    db.contact.deleteMany({}),
    db.company.deleteMany({}),
    db.productPrice.deleteMany({ where: { productId: { startsWith: PRAEFIKS } } }),
    db.product.deleteMany({ where: { id: { startsWith: PRAEFIKS } } }),
    db.productFamily.deleteMany({ where: { id: { startsWith: PRAEFIKS } } }),
  ]);
}

// ---------- Opbygning ----------

type Licens = { id: string; name: string; licenseModel: string; pricePerUserMonth: number | null; oneTimePrice: number | null; documentText: string | null; familyNavn: string };

export type DemoResultat = { kunder: number; produkter: number; licenser: number; poster: number };

export async function bygDemomiljoe(initials: string | null): Promise<DemoResultat> {
  const t = new Terning(lavRng(Date.now() ^ 0x5eed));
  await rydAlt();

  // 1. Katalog
  const maxSort = await db.productFamily.aggregate({ _max: { sortOrder: true } });
  let sort = (maxSort._max.sortOrder ?? 0) + 1;
  for (const p of KATALOG) {
    await db.productFamily.create({
      data: { id: p.id, name: p.name, description: p.description, commercialTerms: p.terms, sortOrder: sort++, updatedBy: initials },
    });
    let ls = 0;
    for (const l of p.licenser) {
      const engang = l.model !== "sub";
      await db.product.create({
        data: {
          id: l.id,
          familyId: p.id,
          name: l.name,
          licenseModel: l.model,
          type: l.model === "fee" ? "service" : "saas",
          tier: l.tier,
          sortOrder: ls++,
          icon: l.icon,
          color: l.color,
          description: l.tekst,
          documentText: l.tekst,
          sku: l.id.replace(PRAEFIKS, "").toUpperCase(),
          pricePerUserMonth: engang ? null : l.pris,
          oneTimePrice: engang ? l.pris : null,
          updatedBy: initials,
        },
      });
      await db.productPrice.createMany({
        data: [
          { productId: l.id, price: l.tidligere, validFrom: dageSiden(t.tal(380, 520)), appliedAt: dageSiden(370), note: "Prisliste 2025", createdBy: initials },
          { productId: l.id, price: l.pris, validFrom: dageSiden(t.tal(20, 300)), appliedAt: dageSiden(10), note: "Prisregulering", createdBy: initials },
        ],
      });
    }
  }

  // Licenser der kan lægges på kunder: demoens + eksisterende (fx Idus) med pris
  const alle = await db.product.findMany({
    where: { isActive: true, OR: [{ pricePerUserMonth: { not: null } }, { oneTimePrice: { not: null } }] },
    include: { family: true },
  });
  const somLicens = (p: (typeof alle)[number]): Licens => ({
    id: p.id, name: p.name, licenseModel: p.licenseModel, pricePerUserMonth: p.pricePerUserMonth, oneTimePrice: p.oneTimePrice,
    documentText: p.documentText, familyNavn: p.family?.name ?? p.name,
  });
  const subs = alle.filter((p) => p.licenseModel === "sub").map(somLicens);
  const perps = alle.filter((p) => p.licenseModel === "perpetual").map(somLicens);
  const fees = alle.filter((p) => p.licenseModel === "fee").map(somLicens);
  const idus = subs.filter((p) => !p.id.startsWith(PRAEFIKS));

  const profilPulje = new Pulje(t, KUNDER);
  const fornavn = new Pulje(t, FORNAVNE);
  const efternavn = new Pulje(t, EFTERNAVNE);
  const titelPulje = new Pulje(t, [...TITLER, ...TITLER]);
  const salgPulje = new Pulje(t, SALGSSAGER);
  const sagPulje = new Pulje(t, SAGER);
  const statusPulje = new Pulje(t, STATUS);
  const subPulje = new Pulje(t, [...t.bland(subs.filter((s) => s.id.startsWith(PRAEFIKS))), ...t.bland(subs.filter((s) => s.id.startsWith(PRAEFIKS)))]);
  const perpPulje = new Pulje(t, [...perps, ...perps, ...perps]);

  const brugerListe = await db.user.findMany({ where: { isActive: true }, select: { initials: true, name: true } });
  const brugere = brugerListe.map((u) => u.initials);
  const af = () => (brugere.length ? t.en(brugere) : initials);
  const brugernavn = (ini: string | null) => brugerListe.find((u) => u.initials === ini)?.name ?? ini;
  const afsender = await hentAfsender();

  let sagNr = 1;
  let kortNr = 1;
  let ordreNr = 1;
  let tilbudNr = 1;
  let poster = 0;
  const ANTAL = 6;

  for (let k = 0; k < ANTAL; k++) {
    const pr = profilPulje.tag();
    const navn = `${pr.forled} ${pr.efterled}`;
    const slug = pr.forled.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "aa").replace(/[^a-z]/g, "");
    const domaene = `${slug}.example`;
    const status = statusPulje.tag();
    const hot = k < 2;
    const ansatte = t.tal(25, 1400);

    const kunde = await db.company.create({
      data: {
        name: navn,
        industry: pr.branche,
        country: pr.land,
        portalCountry: pr.land === "Færøerne" ? "Faroe Islands" : "Denmark, Kingdom of",
        city: pr.by,
        zipCode: pr.postnr,
        address: `${pr.vej} ${t.tal(2, 140)}`,
        orgNumber: `99${t.tal(100000, 999999)}`,
        phone: `${pr.land === "Færøerne" ? "+298" : "+45"} 00 00 ${t.tal(10, 99)} ${t.tal(10, 99)}`,
        email: `info@${domaene}`,
        website: `https://www.${domaene}`,
        accountId: String(950000 + k * 37 + t.tal(1, 30)),
        subdomain: slug,
        runningStatus: "Current",
        currencyCode: pr.land === "Færøerne" ? "DKK (FO)" : "DKK",
        employees: ansatte,
        revenueMdkk: Math.round((ansatte * t.tal(12, 32)) / 10),
        sizeConfidence: t.en(["hoej", "middel", "lav"]),
        sizeNote: "Fiktiv virksomhed til demo. Tal er opdigtede.",
        priority: t.en(["hoej", "middel", "lav"]),
        customerStatus: status,
        customerStatusNote: STATUSNOTE[status],
        customerStatusAt: dageSiden(t.tal(2, 60)),
        isHot: hot,
        hotSince: hot ? dageSiden(t.tal(1, 9)) : null,
        hotSetBy: hot ? af() : null,
        notes: t.en([
          "Kunde siden 2021. Bruger primært systemet i vedligehold og lager.",
          "Koncernen har tre sites; kun ét er i drift endnu.",
          "Stærk superbruger internt — god reference.",
          "Har tidligere brugt regneark til planlægning.",
          "Kører 3-holdsskift; support uden for åbningstid er vigtigt.",
          "Ejerskifte i 2025 — ny ledelse ser på alle IT-aftaler.",
        ]),
        createdAt: dageSiden(t.tal(400, 1400)),
        updatedBy: af(),
      },
    });

    // Kontakter (2–4)
    const kontakter = [];
    const antalKontakter = t.tal(2, 4);
    const roller = t.bland(ROLLER);
    for (let i = 0; i < antalKontakter; i++) {
      const fn = fornavn.tag();
      const en = efternavn.tag();
      kontakter.push(
        await db.contact.create({
          data: {
            companyId: kunde.id, firstName: fn, lastName: en,
            email: `${fn.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "aa")}.${en.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "aa")}@${domaene}`,
            phone: `${pr.land === "Færøerne" ? "+298" : "+45"} 00 00 ${t.tal(10, 99)} ${t.tal(10, 99)}`,
            title: titelPulje.tag(), decisionRole: roller[i % roller.length] || null, isPrimary: i === 0,
            notes: i === 0 ? "Primær kontakt for aftalen." : null, updatedBy: af(),
          },
        })
      );
    }

    // SUB-nøgler (2–3) med licenslinjer — mindst 2 abonnementer og 1 perpetual pr. kunde
    const antalNoegler = t.tal(2, 3);
    const linjer: { id: string; contractId: string; licens: Licens; seats: number; pris: number | null; start: Date; term: number }[] = [];
    const brugtLicens = new Set<string>();
    for (let n = 0; n < antalNoegler; n++) {
      const noegle = await db.contract.create({
        data: { companyId: kunde.id, subNumber: await naesteSubNummer(), name: n === 0 ? "Hovedaftale" : t.en(["Site 2", "Lager", "Teknik", "Pilot", "Energi"]), updatedBy: af() },
      });
      const start = middag(dageSiden(t.tal(60, 900)));
      const term = t.en([12, 12, 24, 36]);
      // Hovedaftalen: 3 linjer (Idus/abonnement, abonnement, perpetual). Sidste nøgle slutter
      // med en perpetual. Så har hver kunde mindst 2 abonnementer og 2 perpetual-licenser.
      const sidste = n === antalNoegler - 1;
      const antalLinjer = n === 0 ? 3 : sidste ? t.tal(1, 2) : t.tal(1, 2);
      for (let j = 0; j < antalLinjer; j++) {
        let licens: Licens;
        if (n === 0 && j === 0 && idus.length && k % 3 !== 2) licens = t.en(idus);
        else if ((n === 0 && j === 2) || (sidste && j === antalLinjer - 1)) licens = perpPulje.tag();
        else licens = subPulje.tag();
        if (brugtLicens.has(licens.id)) {
          const kilde = licens.licenseModel === "sub" ? subs : perps;
          licens = t.en(kilde.filter((x) => !brugtLicens.has(x.id))) ?? licens;
        }
        brugtLicens.add(licens.id);
        const perp = licens.licenseModel !== "sub";
        const seats = perp ? t.tal(1, 6) : t.tal(3, 28);
        const liste = perp ? licens.oneTimePrice : licens.pricePerUserMonth;
        const aftalt = !perp && liste != null && t.chance(0.5) ? Math.round(liste * (1 - t.tal(5, 18) / 100)) : null;
        const cp = await db.customerProduct.create({
          data: {
            companyId: kunde.id, productId: licens.id, contractId: noegle.id,
            seats, activeSeats: perp ? seats : Math.max(1, seats - t.tal(0, Math.min(4, seats - 1))),
            unitPriceMonth: aftalt,
            billingInterval: t.en(["annual", "annual", "quarterly", "biannual", "monthly"]),
            startDate: start, termMonths: term,
            notes: t.chance(0.4) ? t.en(["Inkl. mobil-app", "Prisgaranti til næste fornyelse", "Faktureres til moderselskab", "Rabat aftalt ved opstart"]) : null,
            createdAt: start, updatedBy: af(),
          },
        });
        linjer.push({ id: cp.id, contractId: noegle.id, licens, seats, pris: aftalt ?? liste, start, term });
      }
    }

    // Licenshistorik (tilkøb og reduktioner) — antallet ender på linjens nuværende antal
    for (const l of t.nogle(linjer, Math.max(2, Math.ceil(linjer.length / 2)))) {
      const op = l.seats > 3 && t.chance(0.7);
      const delta = op ? t.tal(1, Math.min(5, l.seats - 1)) : -t.tal(1, 3);
      const foer = l.seats - delta;
      await db.licenseChange.create({
        data: {
          companyId: kunde.id, productId: l.licens.id, customerProductId: l.id, quantity: delta, seatsBefore: foer, seatsAfter: l.seats,
          unitPrice: l.pris, licenseModel: l.licens.licenseModel, date: middag(dageSiden(t.tal(10, 200))),
          note: delta > 0 ? t.en(["Ny tekniker", "Udvidelse til hal 2", "Sæsonhold"]) : t.en(["Medarbejder stoppet", "Afdeling lukket"]),
          createdBy: af(),
        },
      });
      poster++;
    }

    // Salgsmuligheder (2–4) i forskellige stadier
    const deals = [];
    const stadier = t.nogle(STADIER_FORLOEB, t.tal(2, 4));
    for (const stadie of stadier) {
      const lic = t.en(subs);
      const seatDelta = t.tal(2, 15);
      const luk = stadie === "vundet" || stadie === "tabt";
      deals.push(
        await db.deal.create({
          data: {
            companyId: kunde.id, productId: lic.id, title: salgPulje.tag(), seatDelta,
            value: t.chance(0.5) ? null : Math.round(seatDelta * (lic.pricePerUserMonth ?? 300) * 12 * (1 + t.tal(0, 30) / 100)),
            stage: stadie, probability: SANDSYNLIGHED[stadie],
            expectedCloseDate: luk ? null : omDage(t.tal(-5, 90)),
            closedAt: luk ? dageSiden(t.tal(2, 40)) : null,
            lostReason: stadie === "tabt" ? t.en(TABT_AARSAG) : null,
            nextStep: luk ? null : t.en(NAESTE_SKRIDT),
            notes: t.chance(0.5) ? "Kontakten har budgetansvar fra januar." : null,
            stageChangedAt: dageSiden(t.tal(1, 35)),
            createdAt: dageSiden(t.tal(36, 140)), updatedBy: af(),
          },
        })
      );
      poster++;
    }

    // Aktiviteter (2–4)
    for (const a of t.nogle(AKTIVITETER, t.tal(2, 4))) {
      const faerdig = t.chance(0.4);
      await db.activity.create({
        data: {
          companyId: kunde.id, contactId: t.en(kontakter).id, dealId: t.chance(0.6) ? t.en(deals).id : null,
          type: a.type, subject: a.subject, description: t.chance(0.5) ? "Husk at have tal for licensforbrug klar." : null,
          dueDate: faerdig ? dageSiden(t.tal(3, 30)) : omDage(t.tal(-3, 21)), completedAt: faerdig ? dageSiden(t.tal(1, 3)) : null,
          updatedBy: af(),
        },
      });
      poster++;
    }

    // Klippekort (2) med tidsregistreringer
    const kort = [];
    for (let i = 0; i < 2; i++) {
      const timer = t.en([10, 20, 25, 40, 50]);
      kort.push(
        await db.hourBundle.create({
          data: {
            number: kortNr++, companyId: kunde.id, name: i === 0 ? "Supportklippekort" : t.en(["Konsulentklippekort", "Implementering", "Udvikling"]),
            totalHours: timer, price: timer * t.tal(950, 1150), purchaseDate: dageSiden(i === 0 ? t.tal(20, 120) : t.tal(200, 400)),
            expiresAt: i === 0 ? omDage(t.tal(90, 330)) : dageSiden(t.tal(5, 60)), isActive: i === 0, updatedBy: af(),
          },
        })
      );
    }

    // Teknik-sager (2–3) med kommentarer og tid
    const sagStatus = t.nogle(["aaben", "afventer_kunde", "afventer_leverandoer", "loest", "lukket"], t.tal(2, 3));
    for (const st of sagStatus) {
      const s = sagPulje.tag();
      const oprettet = t.tal(1, 60);
      const loest = st === "loest" || st === "lukket";
      const sag = await db.ticket.create({
        data: {
          number: sagNr++, companyId: kunde.id, contactId: t.en(kontakter).id, productId: t.en(linjer).licens.id,
          title: s.title, description: s.description, status: st, priority: t.en(["lav", "normal", "normal", "hoej", "kritisk"]),
          dueAt: loest ? null : omDage(t.tal(-2, 10)), resolvedAt: loest ? dageSiden(t.tal(0, oprettet)) : null,
          closedAt: st === "lukket" ? dageSiden(t.tal(0, oprettet)) : null,
          createdAt: dageSiden(oprettet), updatedBy: af(),
        },
      });
      for (const [i, c] of t.nogle(SAGSKOMMENTARER, t.tal(2, 4)).entries()) {
        await db.ticketComment.create({
          data: { ticketId: sag.id, content: c, isInternal: c.startsWith("Intern"), author: af(), createdAt: dageSiden(Math.max(0, oprettet - i - 1)) },
        });
      }
      for (let i = 0; i < 2; i++) {
        await db.timeLog.create({
          data: {
            companyId: kunde.id, ticketId: sag.id, bundleId: kort[0].id, date: dageSiden(t.tal(0, oprettet)),
            durationMin: t.en([15, 30, 45, 60, 90]), description: t.en(["Fejlsøgning", "Fjernsession", "Test af rettelse", "Dokumentation"]),
            isBillable: t.chance(0.85),
          },
        });
      }
      poster++;
    }
    // Tid på det gamle kort uden sag
    for (let i = 0; i < 2; i++) {
      await db.timeLog.create({
        data: {
          companyId: kunde.id, bundleId: kort[1].id, date: dageSiden(t.tal(70, 300)),
          durationMin: t.en([120, 180, 240, 300]), description: t.en(["Opsætning af ruter", "Kursus for superbrugere", "Datamigrering", "Workshop"]),
        },
      });
    }
    for (const kk of kort) {
      const sum = await db.timeLog.aggregate({ where: { bundleId: kk.id }, _sum: { durationMin: true } });
      await db.hourBundle.update({ where: { id: kk.id }, data: { usedMinutes: sum._sum.durationMin ?? 0 } });
    }

    // Notater (2–3) og logbog (3–5)
    for (const [i, n] of t.nogle(NOTATER, t.tal(2, 3)).entries()) {
      await db.customerNote.create({
        data: {
          companyId: kunde.id, title: n.title, track: n.track, lane: t.en(["nu", "naeste", "venter", "faerdig"]), position: i,
          priority: t.en(["hoej", "normal", "lav"]), dueAt: t.chance(0.6) ? omDage(t.tal(-2, 20)) : null, author: af(), updatedBy: af(),
        },
      });
      poster++;
    }
    for (const lg of t.nogle(LOGTEKSTER, t.tal(3, 5))) {
      await db.logEntry.create({
        data: { companyId: kunde.id, kind: lg.kind, content: lg.content, pinned: t.chance(0.2), author: af(), createdAt: dageSiden(t.tal(1, 120)) },
      });
      poster++;
    }

    // Filbilag: kontrakt, mødereferat og evt. implementeringsplan — alle på den fælles dokumentskabelon
    const kundePdf = {
      navn, adresse: kunde.address, postby: `${pr.postnr} ${pr.by}`, land: pr.land, cvr: kunde.orgNumber, konto: kunde.accountId,
    };
    const fuldtNavn = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`;
    const noegleNumre = new Map<string, number>();
    for (const c of await db.contract.findMany({ where: { companyId: kunde.id }, select: { id: true, subNumber: true } })) noegleNumre.set(c.id, c.subNumber);
    const hovedNr = subNr(noegleNumre.get(linjer[0].contractId));
    const kontraktAf = af();
    const kontrakt = await lavKontrakt({
      afsender, kunde: kundePdf, kontaktperson: fuldtNavn(kontakter[0]), aftalenr: hovedNr,
      aftalestart: linjer[0].start, termMaaneder: linjer[0].term, ansvarlig: brugernavn(kontraktAf),
      linjer: linjer.map((l): KontraktLinje => ({
        sub: subNr(noegleNumre.get(l.contractId)), produkt: l.licens.familyNavn, licens: l.licens.name,
        model: l.licens.licenseModel, antal: l.seats, pris: l.pris,
      })),
    });
    await gemBilag(kunde.id, `Kontrakt_${slug}.pdf`, "kontrakt", kontrakt, kontraktAf, linjer[0].start);

    const referent = af();
    const moedeDato = middag(dageSiden(t.tal(5, 60)));
    const os = brugerListe.length ? t.nogle(brugerListe, Math.min(2, brugerListe.length)) : [{ initials: initials ?? "", name: initials ?? "" }];
    const referat = await lavMoedereferat({
      afsender, kunde: kundePdf, moede: "Statusmøde om drift, support og fornyelse", dato: moedeDato,
      sted: t.en([`Hos ${navn}, ${pr.by}`, "Teams", `Hos ${navn}, ${pr.by}`]), referent: brugernavn(referent),
      naesteMoede: plusDage(moedeDato, t.en([84, 91, 98])),
      deltagere: [
        ...kontakter.slice(0, 3).map((c) => ({ navn: fuldtNavn(c), titel: c.title, virksomhed: navn })),
        ...os.map((u) => ({ navn: u.name, titel: "Konsulent", virksomhed: afsender.navn })),
      ],
      punkter: [
        { titel: "Status på drift og support", tekst: `Systemet kører stabilt. Siden sidste møde er der løst ${t.tal(2, 6)} supportsager; ingen er åbne med høj prioritet. ${fuldtNavn(kontakter[0])} oplever, at svartiden er god.` },
        { titel: "Brug af licenserne", tekst: `Aftalen omfatter ${linjer.reduce((s2, l) => s2 + l.seats, 0)} licenser. Kunden gennemgår, om alle navngivne brugere stadig er aktive, før fornyelsen.` },
        { titel: "Ønsker til næste år", tekst: t.en(["Kunden ønsker at udbrede systemet til lageret og få en mobilapp til teknikerne.", "Kunden ønsker bedre rapporter til ledelsen og et kursus for nye superbrugere.", "Kunden ønsker at koble systemet på ERP, så indkøb af reservedele kan ske direkte."]) },
        { titel: "Fornyelse og priser", tekst: `Aftale ${hovedNr} fornyes på de nuværende vilkår. Leverandøren sender tilbud på evt. tilkøb inden næste møde.` },
      ],
      aktioner: [
        { aktion: "Gennemgå listen over aktive brugere", ansvarlig: fuldtNavn(kontakter[0]), frist: plusDage(moedeDato, 14) },
        { aktion: "Send tilbud på tilkøb og kursus", ansvarlig: brugernavn(referent) ?? "", frist: plusDage(moedeDato, 10) },
        { aktion: "Planlæg næste statusmøde", ansvarlig: brugernavn(referent) ?? "", frist: plusDage(moedeDato, 30) },
      ],
    });
    await gemBilag(kunde.id, `Moedereferat_${slug}.pdf`, "moedereferat", referat, referent, moedeDato);

    if (t.chance(0.6)) {
      const pl = af();
      const ps = middag(dageSiden(t.tal(100, 300)));
      const uge = (n: number) => plusDage(ps, n * 7);
      const faser = [
        { navn: "Opstart og analyse", fra: ps, til: uge(2), aktiviteter: ["Kick-off-møde", "Gennemgang af processer", "Aftale om roller"], ansvarlig: "Leverandør" },
        { navn: "Stamdata og opsætning", fra: uge(2), til: uge(5), aktiviteter: ["Aktivregister og hierarki", "Import af stamdata", "Opsætning af flows"], ansvarlig: "Begge" },
        { navn: "Uddannelse og test", fra: uge(5), til: uge(8), aktiviteter: ["Superbrugerkursus", "Test af arbejdsgange", "Rettelser"], ansvarlig: "Begge" },
        { navn: "Go-live", fra: uge(8), til: uge(9), aktiviteter: ["Idriftsættelse", "Support på stedet"], ansvarlig: "Leverandør" },
        { navn: "Opfølgning", fra: uge(9), til: uge(13), aktiviteter: ["Evaluering efter 30 dage", "Overdragelse til support"], ansvarlig: "Kunde" },
      ];
      const plan = await lavImplementeringsplan({
        afsender, kunde: kundePdf, projekt: `Implementering af ${linjer[0].licens.familyNavn || linjer[0].licens.name}`,
        projektleder: brugernavn(pl), kundensAnsvarlig: fuldtNavn(kontakter[0]), dato: ps,
        formaal: `Planen beskriver, hvordan ${linjer[0].licens.name} sættes i drift hos ${navn}: faser, ansvar, milepæle og hvad der skal være på plads, før systemet går i drift.`,
        faser,
        milepaele: [
          { navn: "Stamdata godkendt", dato: uge(5), kriterie: "Aktivregister og hierarki er importeret og godkendt af kundens ansvarlige." },
          { navn: "Go-live", dato: uge(8), kriterie: "Superbrugere er uddannet, og testene af arbejdsgangene er bestået." },
          { navn: "Overdragelse til drift", dato: uge(13), kriterie: "Evalueringen efter 30 dage er gennemført, og åbne punkter er lukket eller planlagt." },
        ],
        forudsaetninger: [
          "Kunden udpeger en projektansvarlig og 2–4 superbrugere.",
          "Stamdata leveres i den aftalte skabelon senest ved opstart af fase 2.",
          "Superbrugerne kan afsætte tid til kursus og test i fase 3.",
        ],
      });
      await gemBilag(kunde.id, `Plan_${slug}.pdf`, "plan", plan, pl, ps);
    }

    // Dokumenter: ordrebekræftelse på hovedaftalen + tilkøbstilbud på en nøgle
    const kontakt = kontakter[0];
    const adresse = [`${pr.vej}`, `${pr.postnr} ${pr.by}`, pr.land !== "Danmark" ? pr.land : null].filter(Boolean).join("\n");
    const mod = {
      recipientName: navn, recipientAttn: `${kontakt.firstName} ${kontakt.lastName}`, recipientAddress: adresse, recipientEmail: kontakt.email,
    };
    const sf = () => `https://nordvik-demo.lightning.force.com/lightning/r/Opportunity/006${Math.floor(t.tal(1e8, 9e8))}AAA/view`;

    // a) Ordrebekræftelse for opstarten af hovedaftalen
    const hoved = linjer.filter((l) => l.contractId === linjer[0].contractId);
    const fee = t.en(fees);
    const ord = await db.order.create({
      data: {
        kind: "ordre", number: ordreNr++, companyId: kunde.id, contractId: linjer[0].contractId, ...mod,
        reference: `PO-${t.tal(10000, 99999)}`, intro: "Hermed bekræftes aftalen for %KUNDENAVN%.",
        orderDate: linjer[0].start, status: "godkendt", appliedAt: linjer[0].start, salesforceUrl: t.chance(0.7) ? sf() : null,
        createdBy: af(), createdAt: linjer[0].start,
        lines: {
          create: [
            ...hoved.map((l, i) => ({
              productId: l.licens.id, lineKind: "nyt", description: `${l.licens.familyNavn} · ${l.licens.name}`, details: l.licens.documentText,
              quantity: l.seats, unitPrice: l.pris, months: l.licens.licenseModel === "sub" ? l.term : null, licenseModel: l.licens.licenseModel,
              periodStart: l.licens.licenseModel === "sub" ? l.start : null, periodEnd: l.licens.licenseModel === "sub" ? slutFraMaaneder(l.start, l.term) : null,
              sortOrder: i,
            })),
            { productId: fee.id, lineKind: "nyt", description: `${fee.familyNavn} · ${fee.name}`, details: fee.documentText, quantity: t.tal(1, 4), unitPrice: fee.oneTimePrice, months: null, licenseModel: "fee", sortOrder: hoved.length },
          ],
        },
      },
    });
    poster++;

    // b) Tilkøbstilbud på en nøgle med restpris — status varierer
    const subLinjer = linjer.filter((l) => l.licens.licenseModel === "sub");
    const maal = t.en(subLinjer.length ? subLinjer : linjer);
    const udloeb = aftaleUdloeb({ startDate: maal.start, endDate: null, termMonths: maal.term });
    const tStart = middag(dageSiden(t.tal(3, 25)));
    const mdr = maanederMellem(tStart, udloeb);
    const antal = t.tal(1, 5);
    const ekstra = t.en(fees.filter((f) => f.id !== fee.id));
    const tilbudStatus = k % 2 === 0 ? "godkendt" : t.en(["aaben", "afvist"]);
    const contract = await db.contract.findUnique({ where: { id: maal.contractId } });
    const til = await db.order.create({
      data: {
        kind: "tilbud", number: tilbudNr++, companyId: kunde.id, contractId: maal.contractId, ...mod,
        intro: `Hermed fremsendes tilbud på tilkøb til jeres aftale ${subNr(contract?.subNumber)} for %KUNDENAVN%. De nye licenser følger den eksisterende aftale, så prisen er beregnet for restperioden frem til aftalens udløb.`,
        orderDate: tStart, validUntil: plusDage(tStart, 30), status: tilbudStatus,
        acceptedAt: tilbudStatus === "godkendt" ? plusDage(tStart, t.tal(1, 5)) : null, acceptedBy: tilbudStatus === "godkendt" ? af() : null,
        salesforceUrl: sf(), createdBy: af(), createdAt: tStart,
        lines: {
          create: [
            {
              productId: maal.licens.id, customerProductId: maal.id, lineKind: "tilkoeb",
              description: `Tilkøb til ${subNr(contract?.subNumber)}: ${maal.licens.familyNavn} · ${maal.licens.name}`, details: maal.licens.documentText,
              quantity: antal, unitPrice: maal.pris, months: maal.licens.licenseModel === "sub" ? Math.max(1, mdr) : null, licenseModel: maal.licens.licenseModel,
              periodStart: tStart, periodEnd: udloeb, sortOrder: 0,
            },
            { productId: ekstra.id, lineKind: "nyt", description: `${ekstra.familyNavn} · ${ekstra.name}`, details: ekstra.documentText, quantity: t.tal(1, 3), unitPrice: ekstra.oneTimePrice, months: null, licenseModel: "fee", sortOrder: 1 },
          ],
        },
      },
    });
    poster++;

    // c) Fornyelsestilbud på en anden nøgle
    const andre = linjer.filter((l) => l.contractId !== maal.contractId && l.licens.licenseModel === "sub");
    const fornyLinjer = andre.length ? andre.filter((l) => l.contractId === andre[0].contractId) : subLinjer.slice(0, 1);
    const fornyContract = await db.contract.findUnique({ where: { id: fornyLinjer[0].contractId } });
    const fStart = middag(dageSiden(t.tal(1, 15)));
    const fornyStatus = tilbudStatus === "afvist" ? "aaben" : t.en(["aaben", "afvist"]);
    const forny = await db.order.create({
      data: {
        kind: "tilbud", number: tilbudNr++, companyId: kunde.id, contractId: fornyContract?.id, ...mod,
        intro: "Hermed fremsendes tilbud på fornyelse af jeres aftale for %KUNDENAVN%.",
        orderDate: fStart, validUntil: plusDage(fStart, t.en([14, 30, 45])), status: fornyStatus,
        salesforceUrl: t.chance(0.6) ? sf() : null, createdBy: af(), createdAt: fStart,
        note: t.chance(0.5) ? "Prisen er låst i hele perioden ved 24 måneders binding." : null,
        lines: {
          create: fornyLinjer.map((l, i) => {
            const fra = plusDage(aftaleUdloeb({ startDate: l.start, endDate: null, termMonths: l.term }), 1);
            return {
              productId: l.licens.id, customerProductId: l.id, lineKind: "fornyelse",
              description: `Fornyelse: ${l.licens.familyNavn} · ${l.licens.name}`, details: l.licens.documentText,
              quantity: l.seats, unitPrice: l.pris, months: l.term, licenseModel: "sub",
              periodStart: fra, periodEnd: slutFraMaaneder(fra, l.term), sortOrder: i,
            };
          }),
        },
      },
    });
    poster++;

    // d) Ordrebekræftelse på ydelser — kursus, rejse, projektledelse m.m.
    const ydelser = t.nogle(fees, t.tal(2, 4));
    const yDato = middag(dageSiden(t.tal(20, 160)));
    const yd = await db.order.create({
      data: {
        kind: "ordre", number: ordreNr++, companyId: kunde.id, ...mod, reference: t.chance(0.6) ? `PO-${t.tal(10000, 99999)}` : null,
        intro: "Hermed bekræftes levering af følgende ydelser til %KUNDENAVN%.",
        orderDate: yDato, status: "godkendt", appliedAt: yDato, salesforceUrl: t.chance(0.4) ? sf() : null, createdBy: af(), createdAt: yDato,
        note: t.en(["Rejse afregnes efter regning.", "Kursus afholdes hos kunden.", null]),
        lines: {
          create: ydelser.map((f, i) => ({
            productId: f.id, lineKind: "nyt", description: `${f.familyNavn} · ${f.name}`, details: f.documentText,
            quantity: f.name.includes("time") ? t.tal(4, 24) : t.tal(1, 6), unitPrice: f.oneTimePrice, months: null, licenseModel: "fee", sortOrder: i,
          })),
        },
      },
    });
    poster++;

    // PDF'er i filboksen
    for (const o of [ord, til, forny, yd]) {
      const pdf = await ordrePdf(o.id);
      if (pdf) {
        const att = await gemDokumentIFilboks(kunde.id, pdf.navn, pdf.bytes, o.kind === "tilbud" ? "tilbud" : "ordre", o.createdBy);
        await db.order.update({ where: { id: o.id }, data: { attachmentId: att } });
      }
    }

    // Godkendt tilbud: kundens accept + ordrebekræftelse lagt på nøglen
    if (tilbudStatus === "godkendt") {
      const accept = await lavMailudskrift({
        afsender, kunde: kundePdf, titel: `Accept af tilbud ${dokNr(til)}`, reference: dokNr(til),
        fra: `${kontakt.firstName} ${kontakt.lastName} <${kontakt.email}>`,
        til: brugernavn(til.createdBy) ?? afsender.mail ?? afsender.navn,
        emne: `SV: Tilbud ${dokNr(til)}`, sendt: new Date(Math.min(plusDage(tStart, 1).getTime(), Date.now())),
        tekst: `Hej\n\nTak for tilbuddet. Vi accepterer hermed tilbud ${dokNr(til)} som fremsendt.\n\nVenlig hilsen\n${kontakt.firstName} ${kontakt.lastName}\n${kontakt.title ?? ""}\n${navn}`,
      });
      const att = await db.attachment.create({
        data: { companyId: kunde.id, filename: `Accept ${dokNr(til)} - mail.pdf`, category: "accept", mimeType: "application/pdf", sizeBytes: accept.byteLength, data: Buffer.from(accept), uploadedBy: af() },
        select: { id: true },
      });
      await db.order.update({ where: { id: til.id }, data: { acceptAttachmentId: att.id } });
      const oDato = new Date(Math.min(plusDage(tStart, t.tal(2, 6)).getTime(), Date.now()));
      const linjerTil = await db.orderLine.findMany({ where: { orderId: til.id }, orderBy: { sortOrder: "asc" } });
      const ord2 = await db.order.create({
        data: {
          kind: "ordre", number: ordreNr++, companyId: kunde.id, contractId: maal.contractId, ...mod, intro: til.intro,
          orderDate: oDato, sourceOrderId: til.id, status: "godkendt", salesforceUrl: til.salesforceUrl,
          appliedAt: oDato, createdBy: af(), createdAt: oDato,
          lines: { create: linjerTil.map(({ id: _i, orderId: _o, ...l }) => l) },
        },
      });
      // Licenserne på nøglen
      await db.customerProduct.update({ where: { id: maal.id }, data: { seats: { increment: antal } } });
      await db.licenseChange.create({
        data: {
          companyId: kunde.id, productId: maal.licens.id, customerProductId: maal.id, quantity: antal, seatsBefore: maal.seats, seatsAfter: maal.seats + antal,
          unitPrice: maal.pris, licenseModel: maal.licens.licenseModel, date: tStart, note: `${dokNr(ord2)} · tilkøb på ${subNr(contract?.subNumber)}`, createdBy: af(),
        },
      });
      const pdf = await ordrePdf(ord2.id);
      if (pdf) {
        const a2 = await gemDokumentIFilboks(kunde.id, pdf.navn, pdf.bytes, "ordre", ord2.createdBy);
        await db.order.update({ where: { id: ord2.id }, data: { attachmentId: a2 } });
      }
      poster++;
    }

    // Logbog: dokumenterne
    await db.logEntry.create({ data: { companyId: kunde.id, kind: "aftale", content: `Tilbud ${dokNr(til)} udstedt (tilkøb på ${subNr(contract?.subNumber)})`, author: til.createdBy, createdAt: tStart } });
  }

  // Et par notater uden kunde (egen opgavetavle)
  await db.customerNote.createMany({
    data: [
      { title: "Opdatér prisliste for 2027", track: "salg", lane: "naeste", priority: "normal", position: 10, author: initials },
      { title: "Ryd op i gamle sager før månedsskifte", track: "teknik", lane: "nu", priority: "lav", position: 10, author: initials },
    ],
  });

  const licenser = KATALOG.reduce((s, p) => s + p.licenser.length, 0);
  return { kunder: ANTAL, produkter: KATALOG.length, licenser, poster };
}
