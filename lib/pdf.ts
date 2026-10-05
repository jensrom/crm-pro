import "server-only";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Afsender } from "@/lib/dokumenter";

/**
 * PDF-dokumenter: licensbevis og ordrebekræftelse.
 *
 * Bygget med pdf-lib (ren JavaScript, ingen browser eller native moduler), så
 * det virker ens i dev og i den pakkede exe. Standardskrifterne dækker
 * WinAnsi — æ, ø og å er med — og alt andet erstattes, før det skrives.
 */

// ---------- farver (samme rolige palet som appen) ----------
const SORT = rgb(0.12, 0.11, 0.1);
const GRAA = rgb(0.42, 0.4, 0.37);
const LINJE = rgb(0.86, 0.83, 0.78);
const FLADE = rgb(0.965, 0.95, 0.925);
const ORANGE = rgb(0.78, 0.45, 0.22);

const A4 = { b: 595.28, h: 841.89 };
const MARGIN = 50;

const WINANSI_EKSTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function ren(s: string | null | undefined): string {
  if (!s) return "";
  return [...s.replace(/→/g, "->").replace(/\t/g, " ").replace(/\r/g, "")]
    .map((c) => {
      const k = c.charCodeAt(0);
      if (c === "\n") return c;
      if ((k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) || WINANSI_EKSTRA.includes(c)) return c;
      return "?";
    })
    .join("");
}

export const kr = (n: number | null | undefined) =>
  n == null ? "–" : new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " kr.";
export const datoTekst = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d) : "";

type Kol = { titel: string; bredde: number; hoejre?: boolean };

class Dok {
  pdf!: PDFDocument;
  side!: PDFPage;
  y = 0;
  f!: PDFFont;
  fb!: PDFFont;
  logo: PDFImage | null = null;
  sider: PDFPage[] = [];

  constructor(private afsender: Afsender, private titel: string) {}

  async start() {
    this.pdf = await PDFDocument.create();
    this.pdf.setTitle(this.titel);
    this.pdf.setCreator("CRM-Pro");
    this.f = await this.pdf.embedFont(StandardFonts.Helvetica);
    this.fb = await this.pdf.embedFont(StandardFonts.HelveticaBold);
    this.logo = await this.indlejrLogo(this.afsender.logo);
    this.nySide();
  }

  /** Logo øverst til højre på hver side (salgsdokumenter). Kaldes lige efter start(). */
  logoPaaAlleSider() {
    this.logoAlle = true;
    this.tegnSidelogo();
  }

  private async indlejrLogo(dataUrl: string | null) {
    const m = dataUrl?.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m) return null;
    try {
      const bytes = Buffer.from(m[2], "base64");
      return m[1].toLowerCase() === "png" ? await this.pdf.embedPng(bytes) : await this.pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }

  logoAlle = false;

  nySide() {
    this.side = this.pdf.addPage([A4.b, A4.h]);
    this.sider.push(this.side);
    this.y = A4.h - MARGIN;
    // Tynd orange streg i toppen — samme accent som appen
    this.side.drawRectangle({ x: 0, y: A4.h - 6, width: A4.b, height: 6, color: ORANGE });
    if (this.logoAlle) this.tegnSidelogo();
  }

  private tegnSidelogo() {
    const top = A4.h - 30;
    if (this.logo) {
      const s = Math.min(30 / this.logo.height, 140 / this.logo.width);
      const w = this.logo.width * s;
      const h = this.logo.height * s;
      this.side.drawImage(this.logo, { x: A4.b - MARGIN - w, y: top - h, width: w, height: h });
      this.y = top - h - 18;
    } else {
      this.skriv(this.afsender.navn, A4.b - MARGIN, top - 14, { str: 14, fed: true, hoejre: true });
      this.y = top - 34;
    }
  }

  /** Sørger for plads til h punkter — ellers ny side. */
  plads(h: number) {
    if (this.y - h < 92) {
      this.nySide();
      return true;
    }
    return false;
  }

  bredde(t: string, str: number, fed = false) {
    return (fed ? this.fb : this.f).widthOfTextAtSize(ren(t), str);
  }

  skriv(t: string, x: number, y: number, o: { str?: number; fed?: boolean; farve?: ReturnType<typeof rgb>; hoejre?: boolean } = {}) {
    const str = o.str ?? 9.5;
    const tekst = ren(t);
    const xx = o.hoejre ? x - this.bredde(tekst, str, o.fed) : x;
    this.side.drawText(tekst, { x: xx, y, size: str, font: o.fed ? this.fb : this.f, color: o.farve ?? SORT });
  }

  /** Ombryder tekst til en given bredde. Respekterer linjeskift. */
  ombryd(t: string, bredde: number, str = 9.5, fed = false): string[] {
    const ud: string[] = [];
    for (const afsnit of ren(t).split("\n")) {
      let linje = "";
      for (const ord of afsnit.split(/\s+/)) {
        const forsoeg = linje ? `${linje} ${ord}` : ord;
        if (this.bredde(forsoeg, str, fed) <= bredde) linje = forsoeg;
        else {
          if (linje) ud.push(linje);
          // Et enkelt ord der er for langt, hakkes op
          let rest = ord;
          while (this.bredde(rest, str, fed) > bredde && rest.length > 1) {
            let i = rest.length;
            while (i > 1 && this.bredde(rest.slice(0, i), str, fed) > bredde) i--;
            ud.push(rest.slice(0, i));
            rest = rest.slice(i);
          }
          linje = rest;
        }
      }
      ud.push(linje);
    }
    return ud;
  }

  afsnit(
    t: string | null | undefined,
    o: { str?: number; farve?: ReturnType<typeof rgb>; fed?: boolean; x?: number; centreret?: boolean } = {}
  ) {
    if (!t) return;
    const str = o.str ?? 9.5;
    const x = o.x ?? MARGIN;
    for (const l of this.ombryd(t, A4.b - MARGIN - x, str, o.fed)) {
      this.plads(str + 4);
      const xx = o.centreret ? (A4.b - this.bredde(l, str, o.fed)) / 2 : x;
      this.skriv(l, xx, this.y - str, { str, farve: o.farve, fed: o.fed });
      this.y -= str + 4.5;
    }
  }

  /** Logo eller firmanavn til venstre, dokumenttitel og nøgletal til højre. */
  hoved(meta: [string, string][]) {
    const top = this.y;
    if (this.logo) {
      const maksH = 42;
      const maksB = 180;
      const s = Math.min(maksH / this.logo.height, maksB / this.logo.width);
      const h = this.logo.height * s;
      this.side.drawImage(this.logo, { x: MARGIN, y: top - h, width: this.logo.width * s, height: h });
    } else {
      this.skriv(this.afsender.navn, MARGIN, top - 16, { str: 15, fed: true });
    }
    const hx = A4.b - MARGIN;
    this.skriv(this.titel.toUpperCase(), hx, top - 16, { str: 17, fed: true, farve: ORANGE, hoejre: true });
    let my = top - 36;
    for (const [k, v] of meta) {
      if (!v) continue;
      this.skriv(v, hx, my, { str: 9.5, fed: true, hoejre: true });
      this.skriv(k, hx - 130, my, { str: 9, farve: GRAA });
      my -= 14;
    }
    this.y = Math.min(top - 60, my - 6);
  }

  /** To kolonner: modtager til venstre, afsender til højre. */
  parter(venstreTitel: string, venstre: string[], hoejreTitel: string, hoejre: string[]) {
    this.y -= 8;
    const top = this.y;
    const kol2 = A4.b / 2 + 20;
    this.skriv(venstreTitel.toUpperCase(), MARGIN, top - 9, { str: 7.5, fed: true, farve: GRAA });
    this.skriv(hoejreTitel.toUpperCase(), kol2, top - 9, { str: 7.5, fed: true, farve: GRAA });
    let yv = top - 24;
    venstre.filter(Boolean).forEach((l, i) => {
      for (const del of this.ombryd(l, kol2 - MARGIN - 20, i === 0 ? 10.5 : 9.5, i === 0)) {
        this.skriv(del, MARGIN, yv, { str: i === 0 ? 10.5 : 9.5, fed: i === 0 });
        yv -= i === 0 ? 15 : 13;
      }
    });
    let yh = top - 24;
    hoejre.filter(Boolean).forEach((l, i) => {
      this.skriv(l, kol2, yh, { str: i === 0 ? 10.5 : 9.5, fed: i === 0 });
      yh -= i === 0 ? 15 : 13;
    });
    this.y = Math.min(yv, yh) - 14;
  }

  tabel(kol: Kol[], raekker: string[][], o: { fedSidsteKolonne?: boolean } = {}) {
    const total = kol.reduce((s, k) => s + k.bredde, 0);
    const skala = (A4.b - 2 * MARGIN) / total;
    const b = kol.map((k) => k.bredde * skala);
    const xs = b.map((_, i) => MARGIN + b.slice(0, i).reduce((s, v) => s + v, 0));
    const PAD = 6;

    const hoved = () => {
      this.side.drawRectangle({ x: MARGIN, y: this.y - 20, width: A4.b - 2 * MARGIN, height: 20, color: FLADE });
      kol.forEach((k, i) => {
        const x = k.hoejre ? xs[i] + b[i] - PAD : xs[i] + PAD;
        this.skriv(k.titel.toUpperCase(), x, this.y - 13.5, { str: 7.5, fed: true, farve: GRAA, hoejre: k.hoejre });
      });
      this.y -= 20;
    };

    hoved();
    for (const r of raekker) {
      const celler = r.map((c, i) => this.ombryd(c ?? "", b[i] - 2 * PAD, 9.5));
      const linjer = Math.max(...celler.map((c) => c.length));
      const h = linjer * 12.5 + 10;
      if (this.plads(h)) hoved();
      celler.forEach((c, i) => {
        c.forEach((l, j) => {
          const k = kol[i];
          const x = k.hoejre ? xs[i] + b[i] - PAD : xs[i] + PAD;
          const fed = (o.fedSidsteKolonne && i === kol.length - 1) || (i === 0 && j === 0 && false);
          this.skriv(l, x, this.y - 14 - j * 12.5, { str: 9.5, hoejre: k.hoejre, fed });
        });
      });
      this.y -= h;
      this.side.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.b - MARGIN, y: this.y }, thickness: 0.6, color: LINJE });
    }
  }

  /** Højrestillede summer under en tabel. */
  summer(rk: [string, string, boolean?][]) {
    this.y -= 6;
    for (const [k, v, fed] of rk) {
      this.plads(18);
      if (fed) {
        this.side.drawLine({ start: { x: A4.b / 2 + 40, y: this.y - 3 }, end: { x: A4.b - MARGIN, y: this.y - 3 }, thickness: 0.8, color: SORT });
        this.y -= 4;
      }
      this.skriv(k, A4.b / 2 + 46, this.y - 13, { str: fed ? 10.5 : 9.5, fed, farve: fed ? SORT : GRAA });
      this.skriv(v, A4.b - MARGIN - 6, this.y - 13, { str: fed ? 10.5 : 9.5, fed, hoejre: true });
      this.y -= fed ? 20 : 16;
    }
  }

  /** To kolonner: nøgle til venstre, værdi til højre (ombrudt). */
  noegleVaerdi(par: [string, string][]) {
    const kx = MARGIN + 105;
    const b = A4.b - MARGIN - kx;
    for (const [k, v] of par) {
      const linjer = this.ombryd(v, k ? b : A4.b - 2 * MARGIN, 9.5);
      this.plads(linjer.length * 13 + 2);
      if (k) this.skriv(k, MARGIN, this.y - 9.5, { str: 9.5, fed: true });
      linjer.forEach((l, i) => this.skriv(l, k ? kx : MARGIN, this.y - 9.5 - i * 13, { str: 9.5 }));
      this.y -= linjer.length * 13 + 2;
    }
  }

  /**
   * Lange betingelser (T&C) i lille skrift. Linjer der starter med et
   * punktnummer ("1." / "1.1.") eller en definition før en tabulator får et
   * hængende indryk; korte linjer uden punktum (overskrifter) står med fed.
   */
  betingelsestekst(t: string) {
    const str = 7.6;
    const lh = 9.6;
    const ind = 34;
    for (const raa of t.replace(/\r/g, "").split("\n")) {
      const linje = raa.replace(/\s+$/, "");
      if (!linje.trim()) {
        this.y -= lh * 0.6;
        continue;
      }
      const tab = linje.match(/^([^\t]{1,40})\t+(.*)$/);
      const nummer = tab ? tab[1].trim() : "";
      const rest = tab ? tab[2] : linje;
      const overskrift = /^\d+\.$/.test(nummer) || (!tab && linje.length < 60 && !/[.;:]$/.test(linje.trim()));
      // Punktnumre ("1.1.") får et smalt indryk, definitioner ("Agreement") en bred kolonne
      const indryk = tab ? (/^[\d.]+$|^[a-z]\)$|^-$/i.test(nummer) ? ind : 150) : 0;
      const bredde = A4.b - 2 * MARGIN - indryk;
      const dele = this.ombryd(rest, bredde, str, overskrift);
      if (overskrift) this.y -= lh * 0.4;
      this.plads(Math.min(dele.length, 3) * lh);
      if (tab) this.skriv(nummer, MARGIN, this.y - str, { str, fed: overskrift, farve: overskrift ? ORANGE : SORT });
      dele.forEach((d, i) => {
        if (i > 0) this.plads(lh);
        this.skriv(d, MARGIN + indryk, this.y - str, { str, fed: overskrift, farve: overskrift ? ORANGE : rgb(0.25, 0.24, 0.22) });
        this.y -= lh;
      });
    }
  }

  overskrift(t: string) {
    this.plads(30);
    this.y -= 10;
    this.skriv(t.toUpperCase(), MARGIN, this.y - 9, { str: 7.5, fed: true, farve: GRAA });
    this.y -= 16;
  }

  /** Afsenderoplysninger og sidetal nederst på hver side. */
  /** Hvor "Side 1 af N" skal stå i dokumenthovedet (udfyldes, når antal sider kendes). */
  sideFelt: { x: number; y: number } | null = null;

  fod() {
    if (this.sideFelt) {
      this.sider[0].drawText(`1 af ${this.sider.length}`, { x: this.sideFelt.x, y: this.sideFelt.y, size: 9, font: this.f, color: SORT });
    }
    const a = this.afsender;
    // Tre kolonner som Novoteks brevfod: firma | bank og CVR | afdeling
    const kol1 = [a.navn, a.adresse, a.postby, a.telefon ? `Tlf. ${a.telefon}` : null].filter(Boolean) as string[];
    const kol2 = [...(a.bank ?? "").split("\n").map((x) => x.trim()).filter(Boolean), a.cvr ? `CVR: ${a.cvr}` : null].filter(Boolean) as string[];
    const kol3 = [a.afdeling, a.mail, a.web].filter(Boolean) as string[];
    this.sider.forEach((s, i) => {
      s.drawLine({ start: { x: MARGIN, y: 74 }, end: { x: A4.b - MARGIN, y: 74 }, thickness: 0.6, color: LINJE });
      const kolonne = (linjer: string[], x: number) =>
        linjer.slice(0, 6).forEach((t, j) =>
          s.drawText(ren(t), { x, y: 62 - j * 8.5, size: 6.8, font: j === 0 ? this.fb : this.f, color: j === 0 ? SORT : GRAA })
        );
      kolonne(kol1, MARGIN);
      kolonne(kol2, MARGIN + 175);
      kolonne(kol3, MARGIN + 360);
      const sidetal = `Side ${i + 1} af ${this.sider.length}`;
      s.drawText(sidetal, { x: A4.b - MARGIN - this.f.widthOfTextAtSize(sidetal, 7), y: 12, size: 7, font: this.f, color: GRAA });
    });
  }

  async gem() {
    this.fod();
    return this.pdf.save();
  }
}

function afsenderLinjer(a: Afsender) {
  return [a.navn, a.adresse ?? "", a.postby ?? "", a.cvr ? `CVR ${a.cvr}` : "", a.mail ?? "", a.telefon ?? ""];
}

// ============================================================
// LICENSBEVIS
// ============================================================

export type BevisLinje = {
  sub: string;
  produkt: string;
  licens: string;
  model: string;
  antal: number;
  fra: Date | null;
  til: Date | null;
};

export async function lavLicensbevis(d: {
  afsender: Afsender;
  kunde: { navn: string; adresse?: string | null; postby?: string | null; land?: string | null; cvr?: string | null; konto?: string | null };
  reference: string;
  udstedt: Date;
  udstedtAf: string | null;
  linjer: BevisLinje[];
}) {
  const dok = new Dok(d.afsender, "Licensbevis");
  await dok.start();
  dok.hoved([
    ["Reference", d.reference],
    ["Udstedt", datoTekst(d.udstedt)],
    ["Kundekonto", d.kunde.konto ?? ""],
  ]);
  dok.parter(
    "Licenstager",
    [d.kunde.navn, d.kunde.adresse ?? "", [d.kunde.postby, d.kunde.land].filter(Boolean).join(", "), d.kunde.cvr ? `CVR ${d.kunde.cvr}` : ""],
    "Licensgiver",
    afsenderLinjer(d.afsender)
  );

  dok.afsnit(
    `Hermed bekræftes, at ${d.kunde.navn} har ret til at anvende nedenstående licenser i den angivne periode.`,
    { str: 10 }
  );
  dok.y -= 8;

  dok.tabel(
    [
      { titel: "Licensnr.", bredde: 78 },
      { titel: "Produkt / licens", bredde: 190 },
      { titel: "Model", bredde: 70 },
      { titel: "Licenser", bredde: 55, hoejre: true },
      { titel: "Periode", bredde: 120, hoejre: true },
    ],
    d.linjer.map((l) => [
      l.sub,
      `${l.produkt}\n${l.licens}`,
      l.model,
      String(l.antal),
      l.til ? `${datoTekst(l.fra)} - ${datoTekst(l.til)}` : `Fra ${datoTekst(l.fra)}\nTidsubegrænset`,
    ])
  );

  const ialt = d.linjer.reduce((s, l) => s + l.antal, 0);
  dok.summer([["Licenser i alt", String(ialt), true]]);

  if (d.afsender.bevisTekst) {
    dok.overskrift("Vilkår");
    dok.afsnit(d.afsender.bevisTekst, { farve: GRAA, str: 9 });
  }

  // Underskriftsfelt
  dok.plads(70);
  dok.y -= 40;
  dok.side.drawLine({ start: { x: MARGIN, y: dok.y }, end: { x: MARGIN + 200, y: dok.y }, thickness: 0.6, color: SORT });
  dok.skriv(d.udstedtAf ? `${d.udstedtAf}, ${d.afsender.navn}` : d.afsender.navn, MARGIN, dok.y - 12, { str: 9, farve: GRAA });
  dok.skriv(`Udstedt ${datoTekst(d.udstedt)}`, MARGIN, dok.y - 24, { str: 9, farve: GRAA });

  return dok.gem();
}

// ============================================================
// TILBUD OG ORDREBEKRÆFTELSE
// Opbygget som Novoteks egne dokumenter: modtager til venstre, sælgerens
// oplysninger til højre, en indledning og derefter positionerne én for én
// med beskrivelse, periode og nettopris. Til sidst samlet nettopris,
// kommercielle betingelser, hilsen og de generelle betingelser.
// ============================================================

export type OrdreLinjePdf = {
  beskrivelse: string;
  detaljer?: string | null;
  antal: number;
  enhedspris: number | null;
  maaneder: number | null;
  model: string;
  fra?: Date | null;
  til?: Date | null;
};

export function linjebeloeb(l: { antal: number; enhedspris: number | null; maaneder: number | null }) {
  return l.enhedspris == null ? 0 : l.antal * l.enhedspris * (l.maaneder ?? 1);
}

/** "Nøgle: værdi" eller "Nøgle<TAB>værdi" pr. linje → par. Linjer uden skilletegn står alene. */
function betingelsesPar(t: string): [string, string][] {
  return t
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([^:\t]{1,40}?)\s*(?:\t+|:)\s*(.+)$/);
      return m ? ([m[1].trim(), m[2].trim()] as [string, string]) : (["", l] as [string, string]);
    });
}

const langDato = (d: Date) => {
  const ugedag = new Intl.DateTimeFormat("da-DK", { weekday: "long" }).format(d);
  const rest = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" }).format(d);
  return `${ugedag} d. ${rest}`;
};

export type Saelger = { navn: string | null; mail: string | null; telefon: string | null; mobil: string | null };

export async function lavSalgsdokument(d: {
  kind: string;
  afsender: Afsender;
  saelger: Saelger;
  nummer: string;
  tilbudsnummer: string | null;
  dato: Date;
  gyldigTil: Date | null;
  reference: string | null;
  modtager: { navn: string; att?: string | null; adresse?: string | null; mail?: string | null };
  intro: string | null;
  linjer: OrdreLinjePdf[];
  note: string | null;
  betingelser: { name: string; commercialTerms: string | null; generalTerms: string | null }[];
}) {
  const tilbud = d.kind === "tilbud";
  const titel = tilbud ? "Tilbud" : "Ordrebekræftelse";
  const dok = new Dok(d.afsender, titel);
  await dok.start();
  dok.logoPaaAlleSider();

  // Pladsholdere i tekster: %KUNDENAVN%, %KUNDE NAVN%, %KONTAKTPERSON%, %BRUGERENS NAVN%
  const flet = (t: string) =>
    t
      .replace(/%KUNDE ?NAVN%/gi, d.modtager.navn)
      .replace(/%KONTAKTPERSON%/gi, d.modtager.att ?? "")
      .replace(/%BRUGERENS NAVN%/gi, d.saelger.navn ?? "");

  const INDRYK = MARGIN + 100; // kolonnen positionernes tekst står i
  const BELOEB_X = A4.b - MARGIN; // beløb højrestilles her

  // ---------- Hoved: modtager til venstre, sælger og dokumentdata til højre ----------
  const hTop = dok.y;
  let yv = hTop - 12;
  const venstreB = 220;
  const modtagerLinjer = [d.modtager.navn, ...(d.modtager.adresse ?? "").split("\n").filter(Boolean)];
  for (const l of modtagerLinjer) {
    for (const del of dok.ombryd(l, venstreB, 10.5, true)) {
      dok.skriv(del, MARGIN, yv, { str: 10.5, fed: true });
      yv -= 14;
    }
  }
  if (d.modtager.att) {
    yv -= 12;
    for (const del of dok.ombryd(`Att.: ${d.modtager.att}`, venstreB, 10.5, true)) {
      dok.skriv(del, MARGIN, yv, { str: 10.5, fed: true });
      yv -= 14;
    }
  }
  const kx = MARGIN + 265;
  const vx = kx + 78;
  const meta: [string, string][] = [
    ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
    ["Navn", d.saelger.navn ?? ""],
    ["E-mail", d.saelger.mail ?? d.afsender.mail ?? ""],
    ["Tlf. direkte", d.saelger.telefon ?? d.afsender.telefon ?? ""],
    ["Tlf. mobil", d.saelger.mobil ?? ""],
    ["Deres ref.", d.modtager.att ?? ""],
    ["Deres rekv. nr.", d.reference ?? ""],
    ["Vor ordre nr.", tilbud ? "--" : d.nummer],
    ["Vor tilbuds nr.", tilbud ? d.nummer : d.tilbudsnummer ?? "--"],
    ...(tilbud && d.gyldigTil ? ([["Gyldigt til", datoTekst(d.gyldigTil)]] as [string, string][]) : []),
    ["Dato", langDato(d.dato)],
    ["Side", ""],
  ];
  let yh = hTop - 10;
  for (const [k, v] of meta) {
    dok.skriv(k, kx, yh, { str: 8.5, farve: GRAA });
    if (k === "Side") dok.sideFelt = { x: vx, y: yh };
    else dok.skriv(v, vx, yh, { str: 8.5 });
    yh -= 11.5;
  }
  dok.y = Math.min(yv, yh) - 22;

  // ---------- Overskrift og indledning ----------
  const tb = dok.bredde(titel, 15, true);
  dok.skriv(titel, (A4.b - tb) / 2, dok.y - 15, { str: 15, fed: true });
  dok.side.drawRectangle({ x: (A4.b - 36) / 2, y: dok.y - 23, width: 36, height: 2, color: ORANGE });
  dok.y -= 38;
  if (d.intro) {
    dok.afsnit(flet(d.intro), { str: 10.5 });
    dok.y -= 6;
  }

  // ---------- Positioner ----------
  d.linjer.forEach((l, i) => {
    const pos = i + 1;
    const beloeb = linjebeloeb(l);
    dok.plads(80);
    dok.y -= 16;
    const posTekst = `Pos. ${pos}:`;
    dok.skriv(posTekst, MARGIN, dok.y - 11, { str: 11, fed: true });
    dok.side.drawLine({
      start: { x: MARGIN, y: dok.y - 13.5 },
      end: { x: MARGIN + dok.bredde(posTekst, 11, true), y: dok.y - 13.5 },
      thickness: 0.8,
      color: ORANGE,
    });
    const navnLinjer = dok.ombryd(l.beskrivelse, BELOEB_X - INDRYK, 11, true);
    navnLinjer.forEach((t, j) => dok.skriv(t, INDRYK, dok.y - 11 - j * 14.5, { str: 11, fed: true }));
    dok.y -= navnLinjer.length * 14.5 + 10;

    if (l.detaljer) {
      dok.afsnit(flet(l.detaljer), { str: 10, x: INDRYK });
      dok.y -= 6;
    }

    const linjer: string[] = [];
    if (l.maaneder) {
      if (l.fra && l.til) linjer.push(`Periode: ${datoTekst(l.fra)} - ${datoTekst(l.til)} (${l.maaneder} måneder).`);
      if (l.enhedspris != null)
        linjer.push(`${l.antal} ${l.antal === 1 ? "licens" : "licenser"} à ${kr(l.enhedspris)} pr. måned.`);
      linjer.push(`Det samlede beløb for perioden på ${l.maaneder} måneder er ${kr(beloeb)}`);
    } else if (l.enhedspris != null && l.antal > 1) {
      linjer.push(`${l.antal} stk. à ${kr(l.enhedspris)}`);
    }
    for (const t of linjer) dok.afsnit(t, { str: 10, x: INDRYK });

    dok.plads(24);
    dok.y -= 8;
    dok.skriv(`Pris netto pos. ${pos}`, INDRYK, dok.y - 10.5, { str: 10.5, fed: true });
    dok.skriv(kr(beloeb), BELOEB_X, dok.y - 10.5, { str: 10.5, fed: true, hoejre: true });
    dok.y -= 18;
  });

  // ---------- Samlet ----------
  const total = d.linjer.reduce((s, l) => s + linjebeloeb(l), 0);
  dok.plads(40);
  dok.y -= 14;
  dok.side.drawRectangle({ x: MARGIN, y: dok.y - 26, width: A4.b - 2 * MARGIN, height: 26, color: FLADE });
  dok.skriv(d.linjer.length > 1 ? `Samlet pris netto pos. 1 - ${d.linjer.length}` : "Samlet pris netto", MARGIN + 8, dok.y - 17, { str: 11, fed: true });
  dok.skriv(kr(total), BELOEB_X - 8, dok.y - 17, { str: 11, fed: true, hoejre: true });
  dok.y -= 34;

  if (d.note) {
    dok.y -= 4;
    dok.afsnit(flet(d.note), { str: 10 });
  }

  // ---------- Kommercielle betingelser ----------
  const kommercielle = d.betingelser.filter((b) => b.commercialTerms?.trim());
  if (kommercielle.length) {
    for (const [i, b] of kommercielle.entries()) {
      // Gyldighed hører til tilbuddet, ikke ordrebekræftelsen
      const par = betingelsesPar(b.commercialTerms!).filter(([k]) => tilbud || !/^gyldighed/i.test(k));
      // Hold betingelserne (og hilsenen efter den sidste blok) samlet på én side
      const hoejde = par.length * 15 + 40 + (i === kommercielle.length - 1 ? 70 : 0);
      if (hoejde < 400) dok.plads(hoejde);
      dok.overskrift(kommercielle.length > 1 ? `Kommercielle betingelser — ${b.name}` : "Kommercielle betingelser");
      dok.noegleVaerdi(par);
    }
  } else {
    if (d.afsender.betaling) {
      dok.overskrift("Betalingsbetingelser");
      dok.afsnit(d.afsender.betaling);
    }
    if (d.afsender.ordreTekst) {
      dok.overskrift("Betingelser");
      dok.afsnit(d.afsender.ordreTekst, { farve: GRAA, str: 9 });
    }
  }

  dok.y -= 16;
  dok.afsnit(["Med venlig hilsen", d.saelger.navn, d.afsender.navn].filter(Boolean).join("\n"), { str: 10 });

  // ---------- Generelle betingelser bagerst ----------
  for (const b of d.betingelser.filter((x) => x.generalTerms?.trim())) {
    dok.nySide();
    dok.betingelsestekst(b.generalTerms!);
  }

  return dok.gem();
}
