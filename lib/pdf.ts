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

  // ============================================================
  // FÆLLES SKABELON — byggeklodserne alle dokumenter bruges af.
  // Rækkefølgen er altid: standardhoved → nøgletal → sektioner
  // (tabeller, punkter, nummererede afsnit) → underskrifter.
  // ============================================================

  /**
   * Dokumenthovedet: parten (kunde/modtager) til venstre under en lille
   * label, dokumentdata til højre, derefter centreret titel med orange
   * streg og en indledning. "Side" i meta udfyldes, når antal sider kendes.
   */
  standardhoved(o: {
    partTitel: string;
    part: string[];
    att?: string | null;
    meta: [string, string][];
    titel: string;
    undertitel?: string | null;
    intro?: string | null;
  }) {
    const hTop = this.y;
    let yv = hTop - 2;
    this.skriv(o.partTitel.toUpperCase(), MARGIN, yv, { str: 7.5, fed: true, farve: GRAA });
    yv -= 16;
    o.part.filter(Boolean).forEach((l, i) => {
      for (const del of this.ombryd(l, 225, i === 0 ? 10.5 : 9.5, i === 0)) {
        this.skriv(del, MARGIN, yv, { str: i === 0 ? 10.5 : 9.5, fed: i === 0 });
        yv -= i === 0 ? 14 : 12.5;
      }
    });
    if (o.att) {
      yv -= 6;
      for (const del of this.ombryd(`Att.: ${o.att}`, 225, 9.5, true)) {
        this.skriv(del, MARGIN, yv, { str: 9.5, fed: true });
        yv -= 12.5;
      }
    }

    const kx = MARGIN + 265;
    const vx = kx + 92;
    let yh = hTop - 2;
    for (const [k, v] of [...o.meta, ["Side", ""] as [string, string]]) {
      if (!v && k !== "Side") continue;
      this.skriv(k, kx, yh, { str: 8.5, farve: GRAA });
      if (k === "Side") this.sideFelt = { x: vx, y: yh };
      else this.skriv(this.ombryd(v, A4.b - MARGIN - vx, 8.5)[0] ?? "", vx, yh, { str: 8.5 });
      yh -= 11.5;
    }
    this.y = Math.min(yv, yh) - 22;

    const tb = this.bredde(o.titel, 15, true);
    this.skriv(o.titel, (A4.b - tb) / 2, this.y - 15, { str: 15, fed: true });
    this.side.drawRectangle({ x: (A4.b - 36) / 2, y: this.y - 23, width: 36, height: 2, color: ORANGE });
    this.y -= 23;
    if (o.undertitel) {
      const ub = this.bredde(o.undertitel, 9.5);
      this.skriv(o.undertitel, (A4.b - ub) / 2, this.y - 16, { str: 9.5, farve: GRAA });
      this.y -= 16;
    }
    this.y -= 17;
    if (o.intro) {
      this.afsnit(o.intro, { str: 10.5 });
      this.y -= 10;
    }
  }

  /** Nøgletal i én flade med orange kant: [label, værdi, undertekst]. Bredder er andele. */
  noegletal(felter: [string, string, string?][], andele?: number[]) {
    const FULD = A4.b - 2 * MARGIN;
    const PAD = 8;
    const a = andele ?? felter.map(() => 1 / felter.length);
    const kortH = 54;
    this.plads(kortH + 10);
    const top = this.y;
    this.side.drawRectangle({ x: MARGIN, y: top - kortH, width: FULD, height: kortH, color: FLADE });
    this.side.drawRectangle({ x: MARGIN, y: top - kortH, width: 2.5, height: kortH, color: ORANGE });
    let fx = MARGIN + 4;
    felter.forEach(([k, v, u], i) => {
      const b = a[i] * (FULD - 4);
      if (i > 0) this.side.drawLine({ start: { x: fx, y: top - 10 }, end: { x: fx, y: top - kortH + 10 }, thickness: 0.6, color: LINJE });
      const x = fx + PAD + 2;
      const tb = b - 2 * PAD - 2;
      this.skriv(k.toUpperCase(), x, top - 16, { str: 7, fed: true, farve: GRAA });
      this.skriv(this.ombryd(v, tb, 10.5, true)[0] ?? "", x, top - 31, { str: 10.5, fed: true });
      if (u) this.skriv(this.ombryd(u, tb, 8)[0] ?? "", x, top - 44, { str: 8, farve: GRAA });
      fx += b;
    });
    this.y = top - kortH - 6;
  }

  /** To-kolonne tabel med hårlinjer: label (grå) | værdi. */
  noegleTabel(raekker: [string, string][], o: { fedFoerste?: boolean; labelBredde?: number } = {}) {
    const FULD = A4.b - 2 * MARGIN;
    const PAD = 8;
    const nb = o.labelBredde ?? 130;
    this.side.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.b - MARGIN, y: this.y }, thickness: 0.6, color: LINJE });
    raekker.forEach(([k, v], i) => {
      const linjer = this.ombryd(v, FULD - nb - 2 * PAD, 9.5);
      const h = linjer.length * 12.5 + 7;
      this.plads(h);
      this.skriv(k, MARGIN + PAD, this.y - 13, { str: 9, farve: GRAA });
      linjer.forEach((l, j) => this.skriv(l, MARGIN + nb, this.y - 13 - j * 12.5, { str: 9.5, fed: !!o.fedFoerste && i === 0 && j === 0 }));
      this.y -= h;
      this.side.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4.b - MARGIN, y: this.y }, thickness: 0.6, color: LINJE });
    });
    this.y -= 4;
  }

  /** Punktliste med små orange firkanter. */
  punkter(linjer: string[], str = 9.5) {
    const lh = str + 3.5;
    for (const t of linjer) {
      const dele = this.ombryd(t.replace(/^[-•]\s*/, ""), A4.b - 2 * MARGIN - 16, str);
      this.plads(dele.length * lh);
      this.side.drawRectangle({ x: MARGIN + 1, y: this.y - str + 0.5, width: 4, height: 4, color: ORANGE });
      dele.forEach((l, j) => this.skriv(l, MARGIN + 14, this.y - str - j * lh, { str }));
      this.y -= dele.length * lh + 1;
    }
  }

  /**
   * Nummererede afsnit (vilkår, dagsordenspunkter). Med titel står titlen
   * fed på nummerets linje og teksten under; uden titel står teksten direkte.
   */
  nummererede(punkter: { titel?: string | null; tekst?: string | null }[], o: { str?: number; start?: number } = {}) {
    const str = o.str ?? 8.8;
    const lh = str + 2.8;
    const ind = 22;
    const bredde = A4.b - 2 * MARGIN - ind;
    punkter.forEach((p, i) => {
      const titel = p.titel ? this.ombryd(p.titel, bredde, str + 0.7, true) : [];
      const tekst = p.tekst ? this.ombryd(p.tekst, bredde, str) : [];
      this.plads(Math.min(titel.length * (lh + 1) + tekst.length * lh, 3 * lh) + 2);
      this.skriv(`${(o.start ?? 1) + i}.`, MARGIN, this.y - str, { str: str + (titel.length ? 0.7 : 0), fed: true, farve: ORANGE });
      titel.forEach((l) => {
        this.skriv(l, MARGIN + ind, this.y - str, { str: str + 0.7, fed: true });
        this.y -= lh + 1;
      });
      tekst.forEach((l, j) => {
        if (j > 0) this.plads(lh);
        this.skriv(l, MARGIN + ind, this.y - str, { str, farve: rgb(0.25, 0.24, 0.22) });
        this.y -= lh;
      });
      this.y -= titel.length ? 5 : 3;
    });
  }

  /**
   * Tidslinje: én vandret bjælke pr. fase mellem første og sidste dato,
   * med månedsmarkeringer øverst. Bruges i planer.
   */
  tidslinje(faser: { navn: string; fra: Date; til: Date }[]) {
    if (!faser.length) return;
    const labelB = 130;
    const x0 = MARGIN + labelB;
    const x1 = A4.b - MARGIN;
    const start = Math.min(...faser.map((f) => f.fra.getTime()));
    const slut = Math.max(...faser.map((f) => f.til.getTime()));
    const span = Math.max(slut - start, 864e5);
    const xAf = (t: number) => x0 + ((t - start) / span) * (x1 - x0);
    const raekkeH = 20;
    const h = 22 + faser.length * raekkeH + 6;
    this.plads(h);
    const top = this.y;
    // Månedsmarkeringer
    const m = new Date(start);
    m.setDate(1);
    m.setMonth(m.getMonth() + 1);
    this.side.drawLine({ start: { x: x0, y: top - 16 }, end: { x: x1, y: top - 16 }, thickness: 0.6, color: LINJE });
    for (; m.getTime() < slut; m.setMonth(m.getMonth() + 1)) {
      const x = xAf(m.getTime());
      this.side.drawLine({ start: { x, y: top - 16 }, end: { x, y: top - h + 4 }, thickness: 0.4, color: LINJE });
      const t = new Intl.DateTimeFormat("da-DK", { month: "short" }).format(m).replace(".", "");
      this.skriv(t, x + 3, top - 11, { str: 7, farve: GRAA });
    }
    faser.forEach((f, i) => {
      const y = top - 22 - i * raekkeH;
      this.skriv(this.ombryd(f.navn, labelB - 10, 8.5)[0] ?? "", MARGIN, y - 10, { str: 8.5 });
      const a = xAf(f.fra.getTime());
      const b = Math.max(xAf(f.til.getTime()), a + 4);
      this.side.drawRectangle({ x: a, y: y - 13, width: b - a, height: 10, color: i % 2 ? rgb(0.86, 0.6, 0.4) : ORANGE });
    });
    this.y = top - h;
    this.side.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: x1, y: this.y }, thickness: 0.6, color: LINJE });
    this.y -= 6;
  }

  /** Underskriftsfelter til begge parter, holdt samlet. */
  underskrifter(venstre: [string, string, string], hoejre: [string, string, string]) {
    const FULD = A4.b - 2 * MARGIN;
    this.plads(80);
    this.y -= 38;
    const sb = (FULD - 40) / 2;
    const felt = (x: number, [part, navn, linje2]: [string, string, string]) => {
      this.side.drawLine({ start: { x, y: this.y }, end: { x: x + sb, y: this.y }, thickness: 0.6, color: SORT });
      this.skriv(part.toUpperCase(), x, this.y - 12, { str: 7, fed: true, farve: GRAA });
      this.skriv(this.ombryd(navn, sb, 9.5, true)[0] ?? "", x, this.y - 24, { str: 9.5, fed: true });
      this.skriv(linje2, x, this.y - 36, { str: 8.5, farve: GRAA });
    };
    felt(MARGIN, venstre);
    felt(MARGIN + sb + 40, hoejre);
    this.y -= 44;
  }

  /** Reserverer plads til et samlet blok (fx overskrift + kort tabel), hvis den er under en halv side. */
  holdSammen(h: number) {
    if (h < 360) this.plads(h);
  }

  /** Afsenderoplysninger og sidetal nederst på hver side. */
  /** Hvor "Side 1 af N" skal stå i dokumenthovedet (udfyldes, når antal sider kendes). */
  sideFelt: { x: number; y: number } | null = null;

  fod() {
    if (this.sideFelt) {
      this.sider[0].drawText(`1 af ${this.sider.length}`, { x: this.sideFelt.x, y: this.sideFelt.y, size: 9, font: this.f, color: SORT });
    }
    const a = this.afsender;
    // Tre kolonner i brevfoden: firma | bank og CVR | afdeling
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

const kundeLinjer = (k: { navn: string; adresse?: string | null; postby?: string | null; land?: string | null; cvr?: string | null }) =>
  [k.navn, ...(k.adresse ?? "").split("\n"), [k.postby, k.land].filter(Boolean).join(", "), k.cvr ? `CVR ${k.cvr}` : ""].filter(Boolean);

type KundePdf = { navn: string; adresse?: string | null; postby?: string | null; land?: string | null; cvr?: string | null; konto?: string | null };

export async function lavLicensbevis(d: {
  afsender: Afsender;
  kunde: KundePdf;
  reference: string;
  udstedt: Date;
  udstedtAf: string | null;
  linjer: BevisLinje[];
}) {
  const dok = new Dok(d.afsender, "Licensbevis");
  await dok.start();
  dok.logoPaaAlleSider();
  dok.standardhoved({
    partTitel: "Licenstager",
    part: kundeLinjer(d.kunde),
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Reference", d.reference],
      ["Kundekonto", d.kunde.konto ?? ""],
      ["Udstedt af", d.udstedtAf ?? ""],
      ["Dato", langDato(d.udstedt)],
    ],
    titel: "Licensbevis",
    intro: `Hermed bekræftes, at ${d.kunde.navn} har ret til at anvende nedenstående licenser i den angivne periode.`,
  });

  const ialt = d.linjer.reduce((s, l) => s + l.antal, 0);
  const noegler = new Set(d.linjer.map((l) => l.sub)).size;
  dok.noegletal([
    ["Licenstager", d.kunde.navn, d.kunde.konto ? `Kundekonto ${d.kunde.konto}` : ""],
    ["Licenser i alt", String(ialt), `${d.linjer.length} ${d.linjer.length === 1 ? "licenslinje" : "licenslinjer"}`],
    ["Aftaler", String(noegler), noegler === 1 ? "SUB-nøgle" : "SUB-nøgler"],
    ["Udstedt", datoTekst(d.udstedt), "Gælder på udstedelsesdagen"],
  ], [0.34, 0.2, 0.18, 0.28]);

  dok.overskrift("Licenser");
  dok.tabel(
    [
      { titel: "Licensnr.", bredde: 78 },
      { titel: "Produkt / licens", bredde: 190 },
      { titel: "Model", bredde: 70 },
      { titel: "Antal", bredde: 50, hoejre: true },
      { titel: "Periode", bredde: 125, hoejre: true },
    ],
    d.linjer.map((l) => [
      l.sub,
      `${l.produkt}\n${l.licens}`,
      l.model,
      String(l.antal),
      l.til ? `${datoTekst(l.fra)} – ${datoTekst(l.til)}` : `Fra ${datoTekst(l.fra)}\nTidsubegrænset`,
    ])
  );
  dok.summer([["Licenser i alt", String(ialt), true]]);

  if (d.afsender.bevisTekst?.trim()) {
    const v = d.afsender.bevisTekst.split("\n").map((l) => l.trim().replace(/^[-•]\s*/, "").replace(/^\d+[.)]\s*/, "")).filter(Boolean);
    dok.holdSammen(v.length * 24 + 30);
    dok.overskrift("Vilkår");
    dok.nummererede(v.map((tekst) => ({ tekst })));
  }

  dok.underskrifter(
    ["For licensgiver", d.afsender.navn, d.udstedtAf ? `${d.udstedtAf} · ${datoTekst(d.udstedt)}` : datoTekst(d.udstedt)],
    ["For licenstager", d.kunde.navn, "Navn og dato"]
  );
  return dok.gem();
}

// ============================================================
// LICENSBEVIS PÅ EN LEVERET ORDRE
// Ét produkt fra én ordre — laves af intern salg, når varen er klar til
// kunden. Licensnummeret er ordrenummeret; leverandørens reference,
// placering, part-nr. og version kommer fra ordrelinjen.
// ============================================================

const STANDARDVILKAAR_SUB = [
  "Aftalen tegnes for den i kontrakten aftalte periode og forlænges herefter med 12 måneder ad gangen, medmindre andet er aftalt. Faktureres årligt forud.",
  "Opsigelse skal ske skriftligt senest 3 måneder før udløb. Ved ophør bortfalder retten til at bruge de licenserede produkter, og de skal afinstalleres.",
  "Aftalen indeholder vedligehold og support i perioden.",
  "Udvidelser kan tilkøbes løbende og følger aftalens udløb.",
  "Tredjepartssoftware, fx Microsoft Windows, er ikke indeholdt.",
];
const STANDARDVILKAAR_PERPETUAL = [
  "Licensen er evig og gælder for det angivne antal og den angivne placering.",
  "Opdateringer og support kræver en gældende serviceaftale.",
  "Tredjepartssoftware, fx Microsoft Windows, er ikke indeholdt.",
];

export async function lavOrdreLicensbevis(d: {
  afsender: Afsender;
  kunde: KundePdf;
  ordrenr: string;
  leverandoerRef: string | null;
  leverandoerOrdrenr: string | null;
  produkt: string;
  licens: string;
  perpetual: boolean;
  antal: number;
  placering: string | null;
  partNr: string | null;
  version: string | null;
  detaljer: string | null;
  subNr: string | null;
  fra: Date | null;
  til: Date | null;
  pris: number | null;
  udstedt: Date;
  udstedtAf: string | null;
}) {
  const titel = d.perpetual ? "Licensbevis" : "Subscription licensbevis";
  const dok = new Dok(d.afsender, titel);
  await dok.start();
  dok.logoPaaAlleSider();
  dok.standardhoved({
    partTitel: "Licenstager",
    part: kundeLinjer(d.kunde),
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Licensnr.", d.ordrenr],
      ["Subscription-nr.", d.subNr ?? ""],
      ["Ref. hos leverandør", d.leverandoerRef ?? ""],
      ["Kundekonto", d.kunde.konto ?? ""],
      ["Udstedt af", d.udstedtAf ?? ""],
      ["Dato", langDato(d.udstedt)],
    ],
    titel,
    intro: d.perpetual
      ? `Hermed bekræftes, at ${d.kunde.navn} har erhvervet en tidsubegrænset licens til nedenstående produkt på de anførte vilkår.`
      : `Hermed bekræftes, at ${d.kunde.navn} har ret til at anvende nedenstående produkt i aftaleperioden på de anførte vilkår.`,
  });

  dok.noegletal(
    [
      ["Licens", d.licens, d.produkt],
      ["Antal", String(d.antal), d.antal === 1 ? "licens" : "licenser"],
      [d.perpetual ? "Købt" : "Aftaleperiode", d.perpetual ? `Fra ${datoTekst(d.fra ?? d.udstedt)}` : `${datoTekst(d.fra)} – ${datoTekst(d.til)}`, d.perpetual ? "Tidsubegrænset" : "Subscription"],
      [d.perpetual ? "Pris" : "Pris for perioden", d.pris != null ? kr(d.pris) : "–", d.pris != null ? "ekskl. moms" : ""],
    ],
    [0.34, 0.14, 0.28, 0.24]
  );

  // Antal, periode og pris står i nøgletallene; her kun det, der identificerer licensen
  dok.overskrift("Licensoplysninger");
  dok.noegleTabel(
    [
      ["Produkt", d.produkt ? `${d.produkt} · ${d.licens}` : d.licens],
      ...(d.placering ? ([["Placering / info", d.placering]] as [string, string][]) : []),
      ...(d.partNr ? ([["Part-nr.", d.partNr]] as [string, string][]) : []),
      ...(d.version ? ([["Version", d.version]] as [string, string][]) : []),
      ...(d.leverandoerOrdrenr ? ([["Leverandørens ordrenr.", d.leverandoerOrdrenr]] as [string, string][]) : []),
    ],
    { fedFoerste: true }
  );

  const detaljer = (d.detaljer ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (detaljer.length) {
    dok.overskrift("Leverancen omfatter");
    dok.punkter(detaljer);
  }

  const vilkaar = d.afsender.bevisTekst?.trim()
    ? d.afsender.bevisTekst.split("\n").map((l) => l.trim().replace(/^[-•]\s*/, "").replace(/^\d+[.)]\s*/, "")).filter(Boolean)
    : d.perpetual ? STANDARDVILKAAR_PERPETUAL : STANDARDVILKAAR_SUB;
  dok.holdSammen(vilkaar.length * 24 + 30);
  dok.overskrift(d.perpetual ? "Vilkår" : "Subscription-aftale");
  dok.nummererede(vilkaar.map((tekst) => ({ tekst })));

  dok.underskrifter(
    ["For licensgiver", d.afsender.navn, d.udstedtAf ? `${d.udstedtAf} · ${datoTekst(d.udstedt)}` : datoTekst(d.udstedt)],
    ["For licenstager", d.kunde.navn, "Navn og dato"]
  );
  return dok.gem();
}

// ============================================================
// TILBUD OG ORDREBEKRÆFTELSE
// Opbygget som en klassisk dansk forretningsdokument-skabelon: modtager til venstre, sælgerens
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


  // ---------- Fælles standardhoved ----------
  dok.standardhoved({
    partTitel: "Modtager",
    part: [d.modtager.navn, ...(d.modtager.adresse ?? "").split("\n").filter(Boolean)],
    att: d.modtager.att,
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Navn", d.saelger.navn ?? ""],
      ["E-mail", d.saelger.mail ?? d.afsender.mail ?? ""],
      ["Tlf. direkte", d.saelger.telefon ?? d.afsender.telefon ?? ""],
      ["Tlf. mobil", d.saelger.mobil ?? ""],
      ["Deres rekv. nr.", d.reference ?? ""],
      ["Vor ordre nr.", tilbud ? "" : d.nummer],
      ["Vor tilbuds nr.", tilbud ? d.nummer : d.tilbudsnummer ?? ""],
      ["Gyldigt til", tilbud && d.gyldigTil ? datoTekst(d.gyldigTil) : ""],
      ["Dato", langDato(d.dato)],
    ],
    titel,
    intro: d.intro ? flet(d.intro) : null,
  });

  // ---------- Positioner: tabel med Pos. · Beskrivelse · Antal · Pris · Beløb ----------
  const FULD = A4.b - 2 * MARGIN;
  const PAD = 6;
  const kol = { pos: 30, antal: 48, pris: 92, beloeb: 92 };
  const xPos = MARGIN;
  const xBesk = xPos + kol.pos;
  const bBesk = FULD - kol.pos - kol.antal - kol.pris - kol.beloeb;
  const xAntal = xBesk + bBesk;
  const xPris = xAntal + kol.antal;
  const xBeloeb = xPris + kol.pris;
  const hoejreKant = A4.b - MARGIN;

  const tabelHoved = () => {
    dok.side.drawRectangle({ x: MARGIN, y: dok.y - 22, width: FULD, height: 22, color: FLADE });
    const y = dok.y - 14.5;
    const t = { str: 7.5, fed: true, farve: GRAA };
    dok.skriv("POS.", xPos + PAD, y, t);
    dok.skriv("BESKRIVELSE", xBesk + PAD, y, t);
    dok.skriv("ANTAL", xAntal + kol.antal - PAD, y, { ...t, hoejre: true });
    dok.skriv("PRIS", xPris + kol.pris - PAD, y, { ...t, hoejre: true });
    dok.skriv("BELØB", xBeloeb + kol.beloeb - PAD, y, { ...t, hoejre: true });
    dok.y -= 22;
  };

  dok.plads(60);
  dok.y -= 6;
  tabelHoved();

  d.linjer.forEach((l, i) => {
    const beloeb = linjebeloeb(l);
    const tekstB = bBesk - 2 * PAD;
    const navn = dok.ombryd(l.beskrivelse, tekstB, 10, true);
    const detaljer = l.detaljer ? dok.ombryd(flet(l.detaljer), tekstB, 8.5) : [];
    const ekstra: string[] = [];
    if (l.maaneder && l.fra && l.til) ekstra.push(`Periode ${datoTekst(l.fra)} – ${datoTekst(l.til)} (${l.maaneder} mdr.)`);
    else if (l.maaneder) ekstra.push(`${l.maaneder} måneder`);
    const ekstraL = ekstra.flatMap((t) => dok.ombryd(t, tekstB, 8.5));

    const h = 10 + navn.length * 13 + (detaljer.length ? 3 + detaljer.length * 11 : 0) + (ekstraL.length ? 3 + ekstraL.length * 11 : 0) + 8;
    if (dok.plads(Math.min(h, 600))) tabelHoved();

    const top = dok.y;
    let y = top - 10 - 9;
    // Talkolonner på første linje
    dok.skriv(String(i + 1), xPos + PAD, y, { str: 9.5, farve: GRAA });
    dok.skriv(String(l.antal), xAntal + kol.antal - PAD, y, { str: 9.5, hoejre: true });
    if (l.enhedspris != null) {
      dok.skriv(kr(l.enhedspris), xPris + kol.pris - PAD, y, { str: 9.5, hoejre: true });
      if (l.maaneder) dok.skriv("pr. md.", xPris + kol.pris - PAD, y - 11, { str: 8, farve: GRAA, hoejre: true });
    }
    dok.skriv(l.enhedspris == null ? "" : kr(beloeb), xBeloeb + kol.beloeb - PAD, y, { str: 9.5, fed: true, hoejre: true });

    // Beskrivelsen
    navn.forEach((t, j) => dok.skriv(t, xBesk + PAD, y - j * 13, { str: 10, fed: true }));
    y -= navn.length * 13;
    if (ekstraL.length) {
      y -= 3;
      ekstraL.forEach((t) => { dok.skriv(t, xBesk + PAD, y, { str: 8.5, farve: GRAA }); y -= 11; });
    }
    if (detaljer.length) {
      y -= 3;
      for (const t of detaljer) {
        if (y < 92) {
          dok.nySide();
          tabelHoved();
          y = dok.y - 12;
        }
        dok.skriv(t, xBesk + PAD, y, { str: 8.5, farve: GRAA });
        y -= 11;
      }
    }
    dok.y = Math.min(y + 9 - 8, top - h);
    dok.side.drawLine({ start: { x: MARGIN, y: dok.y }, end: { x: hoejreKant, y: dok.y }, thickness: 0.6, color: LINJE });
  });

  // ---------- Total ----------
  const total = d.linjer.reduce((s, l) => s + linjebeloeb(l), 0);
  dok.plads(50);
  dok.y -= 8;
  const tx = xPris - 40;
  dok.side.drawRectangle({ x: tx, y: dok.y - 26, width: hoejreKant - tx, height: 26, color: FLADE });
  dok.side.drawRectangle({ x: tx, y: dok.y - 26, width: 2.5, height: 26, color: ORANGE });
  dok.skriv("I alt ekskl. moms", tx + 12, dok.y - 17, { str: 10.5, fed: true });
  dok.skriv(kr(total), hoejreKant - PAD, dok.y - 17, { str: 10.5, fed: true, hoejre: true });
  dok.y -= 34;
  dok.skriv("Alle beløb er i danske kroner ekskl. moms.", hoejreKant - PAD, dok.y - 8, { str: 8, farve: GRAA, hoejre: true });
  dok.y -= 22;

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
      dok.noegleTabel(par);
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

// ============================================================
// KONTRAKT — aftale om licenser og service
// Kundens samlede aftale: nøglerne (SUB-numre) med licenslinjer,
// aftaleperiode, vilkår og underskrift fra begge parter.
// ============================================================

export type KontraktLinje = {
  sub: string;
  produkt: string;
  licens: string;
  /** "sub" | "perpetual" | "fee" */
  model: string;
  antal: number;
  /** sub: pr. bruger pr. md. — ellers engangspris pr. stk. */
  pris: number | null;
};

const STANDARDVILKAAR_KONTRAKT: { titel: string; tekst: string }[] = [
  { titel: "Aftalens omfang", tekst: "Aftalen omfatter de licenser og ydelser, der er anført ovenfor. Tilkøb lægges på den relevante aftale (SUB-nummer) og følger dennes udløb." },
  { titel: "Aftaleperiode og forlængelse", tekst: "Aftalen løber i den anførte periode fra aftalestart og forlænges herefter automatisk med 12 måneder ad gangen, medmindre den opsiges." },
  { titel: "Opsigelse", tekst: "Opsigelse skal ske skriftligt senest 3 måneder før udløb af den løbende periode. Ved ophør bortfalder retten til at bruge abonnementslicenserne." },
  { titel: "Priser og fakturering", tekst: "Abonnementer faktureres forud efter den aftalte faktureringsfrekvens. Engangsydelser og evige licenser faktureres ved levering. Alle priser er ekskl. moms. Priser kan reguleres én gang årligt med varsel på 3 måneder." },
  { titel: "Vedligehold og support", tekst: "Abonnementer indeholder opdateringer og support i åbningstiden. Evige licenser kræver en gældende serviceaftale for opdateringer og support." },
  { titel: "Data og fortrolighed", tekst: "Kunden ejer sine data. Leverandøren behandler data efter gældende databehandleraftale og videregiver dem ikke til tredjepart." },
  { titel: "Tredjepartssoftware", tekst: "Tredjepartssoftware, fx Microsoft Windows og databaselicenser, er ikke indeholdt, medmindre det fremgår af aftalen." },
];

export async function lavKontrakt(d: {
  afsender: Afsender;
  kunde: KundePdf;
  kontaktperson: string | null;
  aftalenr: string;
  aftalestart: Date;
  termMaaneder: number;
  ansvarlig: string | null;
  linjer: KontraktLinje[];
  vilkaar?: { titel: string; tekst: string }[];
}) {
  const dok = new Dok(d.afsender, "Aftale om licenser og service");
  await dok.start();
  dok.logoPaaAlleSider();
  const udloeb = new Date(d.aftalestart);
  udloeb.setMonth(udloeb.getMonth() + d.termMaaneder);
  udloeb.setDate(udloeb.getDate() - 1);
  dok.standardhoved({
    partTitel: "Kunde",
    part: kundeLinjer(d.kunde),
    att: d.kontaktperson,
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Aftalenr.", d.aftalenr],
      ["Kundekonto", d.kunde.konto ?? ""],
      ["Ansvarlig", d.ansvarlig ?? ""],
      ["Dato", langDato(d.aftalestart)],
    ],
    titel: "Aftale om licenser og service",
    intro: `Denne aftale er indgået mellem ${d.afsender.navn} (leverandør) og ${d.kunde.navn} (kunde) og omfatter de licenser og ydelser, der er anført nedenfor.`,
  });

  const beloeb = (l: KontraktLinje) => (l.pris == null ? 0 : l.model === "sub" ? l.antal * l.pris * 12 : l.antal * l.pris);
  const aarlig = d.linjer.filter((l) => l.model === "sub").reduce((s, l) => s + beloeb(l), 0);
  const engang = d.linjer.filter((l) => l.model !== "sub").reduce((s, l) => s + beloeb(l), 0);
  dok.noegletal(
    [
      ["Aftalestart", datoTekst(d.aftalestart), `Udløb ${datoTekst(udloeb)}`],
      ["Aftaleperiode", `${d.termMaaneder} mdr.`, "Forlænges med 12 mdr."],
      ["Abonnement pr. år", kr(aarlig), "ekskl. moms"],
      ["Engangsbeløb", kr(engang), "Evige licenser og ydelser"],
    ],
    [0.25, 0.22, 0.27, 0.26]
  );

  dok.overskrift("Licenser og ydelser");
  const modelTekst = (m: string) => (m === "sub" ? "Abonnement" : m === "perpetual" ? "Evig licens" : "Ydelse");
  dok.tabel(
    [
      { titel: "Aftale", bredde: 70 },
      { titel: "Produkt / licens", bredde: 175 },
      { titel: "Model", bredde: 72 },
      { titel: "Antal", bredde: 42, hoejre: true },
      { titel: "Pris", bredde: 78, hoejre: true },
      { titel: "Beløb", bredde: 88, hoejre: true },
    ],
    d.linjer.map((l) => [
      l.sub,
      l.produkt ? `${l.produkt}\n${l.licens}` : l.licens,
      modelTekst(l.model),
      String(l.antal),
      l.pris == null ? "–" : l.model === "sub" ? `${kr(l.pris)}\npr. md.` : kr(l.pris),
      l.pris == null ? "–" : l.model === "sub" ? `${kr(beloeb(l))}\npr. år` : kr(beloeb(l)),
    ])
  );
  dok.summer([
    ["Abonnement pr. år", kr(aarlig)],
    ["Engangsbeløb", kr(engang)],
    ["I alt første år", kr(aarlig + engang), true],
  ]);

  const v = d.vilkaar?.length ? d.vilkaar : STANDARDVILKAAR_KONTRAKT;
  dok.holdSammen(140);
  dok.overskrift("Vilkår");
  dok.nummererede(v);

  dok.underskrifter(
    ["For leverandør", d.afsender.navn, d.ansvarlig ? `${d.ansvarlig} · ${datoTekst(d.aftalestart)}` : "Navn og dato"],
    ["For kunde", d.kunde.navn, d.kontaktperson ? `${d.kontaktperson} · navn og dato` : "Navn og dato"]
  );
  return dok.gem();
}

// ============================================================
// IMPLEMENTERINGSPLAN
// ============================================================

export type PlanFase = { navn: string; fra: Date; til: Date; aktiviteter: string[]; ansvarlig: string };
export type PlanMilepael = { navn: string; dato: Date; kriterie: string };

export async function lavImplementeringsplan(d: {
  afsender: Afsender;
  kunde: KundePdf;
  projekt: string;
  projektleder: string | null;
  kundensAnsvarlig: string | null;
  dato: Date;
  formaal: string;
  faser: PlanFase[];
  milepaele: PlanMilepael[];
  forudsaetninger: string[];
}) {
  const dok = new Dok(d.afsender, "Implementeringsplan");
  await dok.start();
  dok.logoPaaAlleSider();
  dok.standardhoved({
    partTitel: "Kunde",
    part: kundeLinjer(d.kunde),
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Projekt", d.projekt],
      ["Projektleder", d.projektleder ?? ""],
      ["Kundens ansvarlige", d.kundensAnsvarlig ?? ""],
      ["Kundekonto", d.kunde.konto ?? ""],
      ["Dato", langDato(d.dato)],
    ],
    titel: "Implementeringsplan",
    undertitel: d.projekt,
    intro: d.formaal,
  });

  const start = new Date(Math.min(...d.faser.map((f) => f.fra.getTime())));
  const slut = new Date(Math.max(...d.faser.map((f) => f.til.getTime())));
  const uger = Math.max(1, Math.round((slut.getTime() - start.getTime()) / (7 * 864e5)));
  const golive = d.milepaele.find((m) => /go-live/i.test(m.navn))?.dato ?? slut;
  dok.noegletal([
    ["Opstart", datoTekst(start), "Kick-off"],
    ["Go-live", datoTekst(golive), "Systemet i drift"],
    ["Varighed", `${uger} uger`, `Afsluttes ${datoTekst(slut)}`],
    ["Faser", String(d.faser.length), `${d.milepaele.length} milepæle`],
  ]);

  dok.overskrift("Tidslinje");
  dok.tidslinje(d.faser);

  dok.overskrift("Faser og aktiviteter");
  dok.tabel(
    [
      { titel: "Fase", bredde: 120 },
      { titel: "Aktiviteter", bredde: 220 },
      { titel: "Periode", bredde: 95 },
      { titel: "Ansvarlig", bredde: 75 },
    ],
    d.faser.map((f, i) => [`${i + 1}. ${f.navn}`, f.aktiviteter.map((a) => `· ${a}`).join("\n"), `${datoTekst(f.fra)}\n${datoTekst(f.til)}`, f.ansvarlig])
  );

  dok.holdSammen(40 + d.milepaele.length * 28);
  dok.overskrift("Milepæle");
  dok.tabel(
    [
      { titel: "Milepæl", bredde: 130 },
      { titel: "Dato", bredde: 70 },
      { titel: "Godkendelseskriterie", bredde: 310 },
    ],
    d.milepaele.map((m) => [m.navn, datoTekst(m.dato), m.kriterie])
  );

  if (d.forudsaetninger.length) {
    dok.holdSammen(40 + d.forudsaetninger.length * 14);
    dok.overskrift("Forudsætninger");
    dok.punkter(d.forudsaetninger);
  }

  dok.underskrifter(
    ["Godkendt af leverandør", d.afsender.navn, d.projektleder ? `${d.projektleder} · navn og dato` : "Navn og dato"],
    ["Godkendt af kunde", d.kunde.navn, d.kundensAnsvarlig ? `${d.kundensAnsvarlig} · navn og dato` : "Navn og dato"]
  );
  return dok.gem();
}

// ============================================================
// MØDEREFERAT
// ============================================================

export async function lavMoedereferat(d: {
  afsender: Afsender;
  kunde: KundePdf;
  moede: string;
  dato: Date;
  sted: string;
  referent: string | null;
  naesteMoede: Date | null;
  deltagere: { navn: string; titel: string | null; virksomhed: string }[];
  punkter: { titel: string; tekst: string }[];
  aktioner: { aktion: string; ansvarlig: string; frist: Date | null }[];
}) {
  const dok = new Dok(d.afsender, "Mødereferat");
  await dok.start();
  dok.logoPaaAlleSider();
  dok.standardhoved({
    partTitel: "Kunde",
    part: kundeLinjer(d.kunde),
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Sted", d.sted],
      ["Referent", d.referent ?? ""],
      ["Kundekonto", d.kunde.konto ?? ""],
      ["Dato", langDato(d.dato)],
    ],
    titel: "Mødereferat",
    undertitel: d.moede,
    intro: null,
  });

  dok.noegletal([
    ["Mødedato", datoTekst(d.dato), d.sted],
    ["Deltagere", String(d.deltagere.length), `${new Set(d.deltagere.map((x) => x.virksomhed)).size} virksomheder`],
    ["Aktionspunkter", String(d.aktioner.length), "Se nederst"],
    ["Næste møde", d.naesteMoede ? datoTekst(d.naesteMoede) : "Aftales", ""],
  ]);

  dok.overskrift("Deltagere");
  dok.tabel(
    [
      { titel: "Navn", bredde: 170 },
      { titel: "Titel", bredde: 170 },
      { titel: "Virksomhed", bredde: 170 },
    ],
    d.deltagere.map((x) => [x.navn, x.titel ?? "", x.virksomhed])
  );

  dok.holdSammen(120);
  dok.overskrift("Dagsorden og referat");
  dok.nummererede(d.punkter, { str: 9.2 });

  if (d.aktioner.length) {
    dok.holdSammen(40 + d.aktioner.length * 26);
    dok.overskrift("Aktionspunkter");
    dok.tabel(
      [
        { titel: "Nr.", bredde: 30 },
        { titel: "Aktion", bredde: 300 },
        { titel: "Ansvarlig", bredde: 110 },
        { titel: "Frist", bredde: 70, hoejre: true },
      ],
      d.aktioner.map((a, i) => [String(i + 1), a.aktion, a.ansvarlig, a.frist ? datoTekst(a.frist) : "–"])
    );
  }
  return dok.gem();
}

// ============================================================
// E-MAIL SOM PDF (fx kundens accept af et tilbud)
// ============================================================

export async function lavMailudskrift(d: {
  afsender: Afsender;
  kunde: KundePdf;
  titel: string;
  reference: string | null;
  fra: string;
  til: string;
  emne: string;
  sendt: Date;
  tekst: string;
}) {
  const dok = new Dok(d.afsender, d.titel);
  await dok.start();
  dok.logoPaaAlleSider();
  dok.standardhoved({
    partTitel: "Kunde",
    part: kundeLinjer(d.kunde),
    meta: [
      ["Afdeling", d.afsender.afdeling ?? d.afsender.navn],
      ["Reference", d.reference ?? ""],
      ["Kundekonto", d.kunde.konto ?? ""],
      ["Modtaget", langDato(d.sendt)],
    ],
    titel: d.titel,
    undertitel: "Udskrift af e-mail gemt i kundens filboks",
  });

  dok.overskrift("E-mail");
  dok.noegleTabel([
    ["Fra", d.fra],
    ["Til", d.til],
    ["Sendt", `${langDato(d.sendt)} kl. ${new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(d.sendt)}`],
    ["Emne", d.emne],
  ], { labelBredde: 70 });
  dok.y -= 10;
  dok.afsnit(d.tekst, { str: 10 });
  return dok.gem();
}
