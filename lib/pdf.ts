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

  nySide() {
    this.side = this.pdf.addPage([A4.b, A4.h]);
    this.sider.push(this.side);
    this.y = A4.h - MARGIN;
    // Tynd orange streg i toppen — samme accent som appen
    this.side.drawRectangle({ x: 0, y: A4.h - 6, width: A4.b, height: 6, color: ORANGE });
  }

  /** Sørger for plads til h punkter — ellers ny side. */
  plads(h: number) {
    if (this.y - h < MARGIN + 60) {
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

  afsnit(t: string | null | undefined, o: { str?: number; farve?: ReturnType<typeof rgb>; fed?: boolean } = {}) {
    if (!t) return;
    const str = o.str ?? 9.5;
    for (const l of this.ombryd(t, A4.b - 2 * MARGIN, str, o.fed)) {
      this.plads(str + 4);
      this.skriv(l, MARGIN, this.y - str, { str, farve: o.farve, fed: o.fed });
      this.y -= str + 4;
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

  overskrift(t: string) {
    this.plads(30);
    this.y -= 10;
    this.skriv(t.toUpperCase(), MARGIN, this.y - 9, { str: 7.5, fed: true, farve: GRAA });
    this.y -= 16;
  }

  /** Afsenderoplysninger og sidetal nederst på hver side. */
  fod() {
    const a = this.afsender;
    const linje1 = [a.navn, a.cvr ? `CVR ${a.cvr}` : null, a.adresse, a.postby, a.land].filter(Boolean).join("  ·  ");
    const linje2 = [a.telefon, a.mail, a.web, a.bank].filter(Boolean).join("  ·  ");
    this.sider.forEach((s, i) => {
      s.drawLine({ start: { x: MARGIN, y: 48 }, end: { x: A4.b - MARGIN, y: 48 }, thickness: 0.6, color: LINJE });
      const skriv = (t: string, y: number) => {
        const tt = ren(t);
        const w = this.f.widthOfTextAtSize(tt, 7.5);
        s.drawText(tt, { x: (A4.b - w) / 2, y, size: 7.5, font: this.f, color: GRAA });
      };
      skriv(linje1, 36);
      if (linje2) skriv(linje2, 26);
      const sidetal = `Side ${i + 1} af ${this.sider.length}`;
      s.drawText(sidetal, { x: A4.b - MARGIN - this.f.widthOfTextAtSize(sidetal, 7.5), y: 14, size: 7.5, font: this.f, color: GRAA });
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
// ORDREBEKRÆFTELSE
// ============================================================

export type OrdreLinjePdf = {
  beskrivelse: string;
  antal: number;
  enhedspris: number | null;
  maaneder: number | null;
  model: string;
};

export function linjebeloeb(l: { antal: number; enhedspris: number | null; maaneder: number | null }) {
  return l.enhedspris == null ? 0 : l.antal * l.enhedspris * (l.maaneder ?? 1);
}

export async function lavOrdrebekraeftelse(d: {
  afsender: Afsender;
  nummer: string;
  dato: Date;
  reference: string | null;
  konto: string | null;
  modtager: { navn: string; att?: string | null; adresse?: string | null; mail?: string | null };
  linjer: OrdreLinjePdf[];
  moms: number;
  note: string | null;
  udstedtAf: string | null;
}) {
  const dok = new Dok(d.afsender, "Ordrebekræftelse");
  await dok.start();
  dok.hoved([
    ["Ordrenr.", d.nummer],
    ["Ordredato", datoTekst(d.dato)],
    ["Jeres reference", d.reference ?? ""],
    ["Kundekonto", d.konto ?? ""],
  ]);
  dok.parter(
    "Kunde",
    [d.modtager.navn, d.modtager.att ? `Att. ${d.modtager.att}` : "", ...(d.modtager.adresse ?? "").split("\n"), d.modtager.mail ?? ""],
    "Leverandør",
    afsenderLinjer(d.afsender)
  );

  dok.afsnit("Tak for jeres ordre. Vi bekræfter hermed følgende:", { str: 10 });
  dok.y -= 8;

  dok.tabel(
    [
      { titel: "Beskrivelse", bredde: 210 },
      { titel: "Antal", bredde: 45, hoejre: true },
      { titel: "Enhedspris", bredde: 95, hoejre: true },
      { titel: "Periode", bredde: 65, hoejre: true },
      { titel: "Beløb", bredde: 95, hoejre: true },
    ],
    d.linjer.map((l) => [
      l.beskrivelse,
      String(l.antal),
      l.enhedspris == null ? "-" : `${kr(l.enhedspris)}${l.maaneder ? "\npr. md." : ""}`,
      l.maaneder ? `${l.maaneder} mdr.` : "Engang",
      kr(linjebeloeb(l)),
    ]),
    { fedSidsteKolonne: true }
  );

  const sub = d.linjer.reduce((s, l) => s + linjebeloeb(l), 0);
  const moms = (sub * d.moms) / 100;
  dok.summer([
    ["Subtotal ekskl. moms", kr(sub)],
    [`Moms ${String(d.moms).replace(".", ",")} %`, kr(moms)],
    ["Total inkl. moms", kr(sub + moms), true],
  ]);

  if (d.note) {
    dok.overskrift("Bemærkninger");
    dok.afsnit(d.note);
  }
  if (d.afsender.betaling) {
    dok.overskrift("Betalingsbetingelser");
    dok.afsnit(d.afsender.betaling);
  }
  if (d.afsender.ordreTekst) {
    dok.overskrift("Betingelser");
    dok.afsnit(d.afsender.ordreTekst, { farve: GRAA, str: 9 });
  }
  if (d.udstedtAf) {
    dok.y -= 14;
    dok.afsnit(`Med venlig hilsen\n${d.udstedtAf}\n${d.afsender.navn}`);
  }

  return dok.gem();
}
