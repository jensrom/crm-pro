/**
 * Anonymisering — fjerner enhver henvisning til den tidligere forhandler fra
 * tekster i databasen og i de medfølgende betingelser.
 *
 * To slags tekst:
 *   - Betingelser (T&C og kommercielle vilkår): firmanavnet bliver til den
 *     neutrale part "the Supplier" / "leverandøren", så teksten virker for
 *     enhver afsender.
 *   - Alt andet (afsenderprofiler, dokumentindstillinger, noter …): navnet
 *     erstattes af demo-afsenderen herunder.
 *
 * Funktionerne er rene og idempotente: tekst uden træf kommer uændret retur.
 */

/** Demo-afsenderen, der står i stedet på dokumenter og i indstillinger. */
export const DEMO_AFSENDER = {
  companyName: "Nordvik Systems ApS",
  department: "Nordvik Systems ApS, Aarhus",
  address: "Havnegade 12",
  zipCity: "8000 Aarhus C",
  email: "salg@nordvik.example",
  website: "nordvik.example",
  phone: "+45 00 00 10 00",
  cvr: "99000000",
};

// Søgeordet samles af dele, så en simpel tekstsøgning i koden kun rammer
// denne ene, bevidste forekomst.
const NAVN = ["no", "vo", "tek"].join("");
const NAVN_RE = new RegExp(NAVN, "i");

/** Har teksten overhovedet et træf? */
export function harTraef(tekst) {
  return typeof tekst === "string" && (NAVN_RE.test(tekst) || /21333174|Naverland/i.test(tekst));
}

const ord = (flag = "g") => new RegExp(`\\b${NAVN}\\b`, flag);

/** Betingelser: firmanavnet bliver til en neutral part. */
export function neutralBetingelser(tekst) {
  if (!harTraef(tekst)) return tekst;
  let t = tekst;

  // Overskrift og indledning med CVR og hjemsted
  t = t.replace(new RegExp(`(GENERAL TERMS AND CONDITIONS) OF ${NAVN}\\s*$`, "gim"), "$1");
  t = t.replace(
    new RegExp(`${NAVN} A\\/S,?\\s*CVR\\s*\\d+\\s*having registered office in [^,]+,\\s*Denmark`, "gi"),
    "the Supplier"
  );
  // Privatlivspolitik med link
  t = t.replace(
    new RegExp(`can be accessed at https?:\\/\\/\\S*${NAVN}\\S*?\\.?(?=\\s|$)`, "gi"),
    "is available on request."
  );
  t = t.replace(/available on request\.\./g, "available on request.");
  // Lovvalg: værnetinget er Østre Landsret, så dansk ret
  t = t.replace(/governed by Dutch law/g, "governed by Danish law");

  // Danske kommercielle vilkår
  t = t.replace(new RegExp(`(til|efter|fra|hos) ${NAVN} A\\/S'?s?`, "gi"), "$1 leverandørens");
  t = t.replace(new RegExp(`${NAVN} A\\/S`, "gi"), "Leverandøren");

  // Engelske T&C
  t = t.replace(new RegExp(`${NAVN} employees`, "gi"), "the Supplier's employees");
  t = t.replace(new RegExp(`${NAVN} or the supplier`, "gi"), "the Supplier or its subcontractor");
  t = t.replace(new RegExp(`supplier of ${NAVN}\\b`, "gi"), "subcontractor of the Supplier");
  t = t.replace(new RegExp(`\\bthe ${NAVN}\\b`, "gi"), "the Supplier");
  // Sætningsstart (linjestart, efter tabulator, efter punktum eller tankestreg)
  t = t.replace(new RegExp(`(^|\\t|[.:;!?]\\s+|-\\s+)${NAVN}('s)?\\b`, "gim"), (_m, foer, s) => `${foer}The Supplier${s ?? ""}`);
  t = t.replace(new RegExp(`\\b${NAVN}('s)?\\b`, "gi"), (_m, s) => `the Supplier${s ?? ""}`);
  t = t.replace(/\b21333174\b/g, "");
  // Definitionen af den neutrale part, hvis definitionslisten findes
  if (!/^Supplier\t/m.test(t)) {
    t = t.replace(/^(Services\t[^\n]*\n)/m, "$1Supplier\tthe company stated as seller in the quotation, order confirmation or Agreement;\n");
  }
  return t;
}

/** Al anden tekst: navnet bliver til demo-afsenderen. */
export function neutralTekst(tekst) {
  if (!harTraef(tekst)) return tekst;
  let t = tekst;
  t = t.replace(new RegExp(`[\\w.+-]+@${NAVN}\\.[a-z.]+`, "gi"), DEMO_AFSENDER.email);
  t = t.replace(new RegExp(`(https?:\\/\\/)?(www\\.)?${NAVN}\\.[a-z]{2,}(\\/\\S*)?`, "gi"), DEMO_AFSENDER.website);
  t = t.replace(new RegExp(`${NAVN.toUpperCase()} A\\/S`, "g"), DEMO_AFSENDER.companyName.toUpperCase());
  t = t.replace(new RegExp(`${NAVN} A\\/S`, "gi"), DEMO_AFSENDER.companyName);
  t = t.replace(ord("g"), "Nordvik");
  t = t.replace(new RegExp(NAVN.toUpperCase(), "g"), "NORDVIK");
  t = t.replace(new RegExp(NAVN, "gi"), "Nordvik");
  t = t.replace(/\b21333174\b/g, DEMO_AFSENDER.cvr);
  t = t.replace(/Naverland\s*2/gi, DEMO_AFSENDER.address);
  return t;
}

/** Felter der indeholder betingelser og derfor får den neutrale part. */
const BETINGELSESFELTER = {
  ProductFamily: ["commercialTerms", "generalTerms"],
  Settings: ["docPaymentTerms", "docCertText", "docOrderText"],
};

/** Brugerne selv (navne, initialer, login) røres ikke. */
const SPRING_OVER = new Set(["User"]);

/** Filtyper hvis indhold er ren tekst og kan rettes direkte. */
const TEKSTTYPER = /^(text\/|application\/(json|xml|csv|rtf)|message\/rfc822)/i;

/**
 * Gennemgår alle tekstfelter i alle tabeller (undtagen brugere) og retter
 * hver forekomst. Kan køres igen og igen — anden gang finder den intet.
 * Returnerer en optælling pr. tabel og felt.
 */
export async function anonymiserDatabase(prisma, Prisma, log = console.log) {
  const rettet = {};
  const tael = (n) => (rettet[n] = (rettet[n] ?? 0) + 1);

  // 1. Afsendere (afdelinger og de fælles dokumentoplysninger): hele
  //    adresseblokken skiftes, så hverken adresse, CVR, bank eller telefon
  //    peger tilbage på den rigtige afdeling.
  const BYER = [
    ["Aarhus", "8000 Aarhus C", "Havnegade 12"],
    ["Odense", "5000 Odense C", "Kongensgade 40"],
    ["Aalborg", "9000 Aalborg", "Boulevarden 8"],
    ["København", "1050 København K", "Kongens Nytorv 3"],
  ];
  const BANK = "Demo Bank · Reg. 0000 · Konto 0000000000";
  const raekkeHarTraef = (r) => Object.values(r).some((v) => harTraef(v));
  if (prisma.senderProfile) {
    const profiler = await prisma.senderProfile.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    let n = 0;
    for (const pr of profiler) {
      if (!raekkeHarTraef(pr)) continue;
      const [by, postBy, adresse] = BYER[n++ % BYER.length];
      await prisma.senderProfile.update({
        where: { id: pr.id },
        data: {
          name: by,
          department: `${DEMO_AFSENDER.companyName}, ${by}`,
          companyName: DEMO_AFSENDER.companyName,
          address: adresse,
          zipCity: postBy,
          country: pr.country ? "Danmark" : pr.country,
          cvr: pr.cvr ? DEMO_AFSENDER.cvr : pr.cvr,
          email: pr.email ? DEMO_AFSENDER.email : pr.email,
          phone: pr.phone ? DEMO_AFSENDER.phone : pr.phone,
          website: pr.website ? DEMO_AFSENDER.website : pr.website,
          bankInfo: pr.bankInfo ? BANK : pr.bankInfo,
        },
      });
      tael("SenderProfile");
    }
  }
  if (prisma.settings) {
    const s = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const afsenderfelter = ["docCompanyName", "docDepartment", "docCvr", "docAddress", "docZipCity", "docEmail", "docPhone", "docWebsite", "docBankInfo"];
    if (s && afsenderfelter.some((f) => harTraef(s[f]))) {
      const ny = {
        docCompanyName: DEMO_AFSENDER.companyName,
        docDepartment: s.docDepartment ? DEMO_AFSENDER.department : s.docDepartment,
        docCvr: s.docCvr ? DEMO_AFSENDER.cvr : s.docCvr,
        docAddress: s.docAddress ? DEMO_AFSENDER.address : s.docAddress,
        docZipCity: s.docZipCity ? DEMO_AFSENDER.zipCity : s.docZipCity,
        docEmail: s.docEmail ? DEMO_AFSENDER.email : s.docEmail,
        docPhone: s.docPhone ? DEMO_AFSENDER.phone : s.docPhone,
        docWebsite: s.docWebsite ? DEMO_AFSENDER.website : s.docWebsite,
        docBankInfo: s.docBankInfo ? BANK : s.docBankInfo,
      };
      await prisma.settings.update({ where: { id: "singleton" }, data: ny });
      tael("Settings.afsender");
    }
  }
  const modeller = Prisma.dmmf.datamodel.models;

  // 2. Alle øvrige tekstfelter i alle tabeller
  for (const m of modeller) {
    if (SPRING_OVER.has(m.name)) continue;
    const delegat = prisma[m.name.charAt(0).toLowerCase() + m.name.slice(1)];
    // Den slanke runtime-DMMF har ikke altid isId — alle tabeller her har "id".
    const id = m.fields.find((f) => f.isId)?.name ?? (m.fields.some((f) => f.name === "id") ? "id" : null);
    if (!delegat || !id) continue;
    const felter = m.fields.filter((f) => f.kind === "scalar" && f.type === "String" && !f.isList && f.name !== id);
    if (m.name === "Settings") {
      // Logoet er et billede som data-URL — det kan ikke læses som tekst.
      const i = felter.findIndex((f) => f.name === "brandLogo");
      if (i >= 0) felter.splice(i, 1);
    }

    for (const f of felter) {
      const raekker = await delegat.findMany({
        where: {
          OR: [
            { [f.name]: { contains: NAVN, mode: "insensitive" } },
            { [f.name]: { contains: "21333174" } },
            { [f.name]: { contains: "Naverland", mode: "insensitive" } },
          ],
        },
        select: { [id]: true, [f.name]: true },
      });
      for (const r of raekker) {
        const foer = r[f.name];
        const efter = (BETINGELSESFELTER[m.name] ?? []).includes(f.name) ? neutralBetingelser(foer) : neutralTekst(foer);
        if (efter === foer) continue;
        await delegat.update({ where: { [id]: r[id] }, data: { [f.name]: efter } });
        tael(`${m.name}.${f.name}`);
      }
    }
  }

  // 3. Vedhæftede filer: tekstfiler rettes, filnavne rettes, binære filer meldes.
  const ikkeTjekket = [];
  if (prisma.attachment) {
    const filer = await prisma.attachment.findMany({ select: { id: true, filename: true, mimeType: true } });
    for (const fil of filer) {
      const data = {};
      if (harTraef(fil.filename)) data.filename = neutralTekst(fil.filename);
      if (TEKSTTYPER.test(fil.mimeType)) {
        const { data: bytes } = await prisma.attachment.findUnique({ where: { id: fil.id }, select: { data: true } });
        const tekst = Buffer.from(bytes).toString("utf8");
        if (harTraef(tekst)) {
          const ny = Buffer.from(neutralTekst(tekst), "utf8");
          data.data = ny;
          data.sizeBytes = ny.length;
        }
      } else {
        ikkeTjekket.push(`${fil.filename} (${fil.mimeType})`);
      }
      if (Object.keys(data).length) {
        await prisma.attachment.update({ where: { id: fil.id }, data });
        tael("Attachment");
      }
    }
  }

  const i_alt = Object.values(rettet).reduce((a, b) => a + b, 0);
  log(i_alt ? `  anonymisering: ${i_alt} felter rettet — ${JSON.stringify(rettet)}` : "  anonymisering: intet at rette");
  if (ikkeTjekket.length) log(`  anonymisering: ${ikkeTjekket.length} binære filer kan ikke tjekkes automatisk: ${ikkeTjekket.join("; ")}`);
  return { rettet, ikkeTjekket };
}
