/**
 * Fiktive kunder og kontaktpersoner.
 *
 * Bruges til at erstatte rigtige kundedata med tilsvarende, opdigtede data:
 * samme branche, land, størrelse og licenser — men navne, adresser, CVR,
 * mail, telefon og kontaktpersoner er opfundet. Alt er deterministisk ud fra
 * et løbenummer, så samme kunde altid får samme fiktive identitet.
 *
 * Mail og web bruger domænet .example (reserveret til eksempler, RFC 2606),
 * telefonnumre har formen +45 00 00 xx xx, og CVR-numre starter med 99 —
 * ingen af delene kan ramme en rigtig virksomhed eller person.
 */

const FORLED = [
  "Nordlys", "Vesterhav", "Fjordbak", "Skovly", "Havnefront", "Kystlinje", "Lyngbakke", "Bjergholm", "Ådalen", "Engvang",
  "Klitgård", "Solhøj", "Stenager", "Bølgeslag", "Mosebo", "Egelund", "Havtorn", "Saltværk", "Mølleå", "Granly",
  "Vindeby", "Strandhuse", "Dalsgård", "Hedebo", "Lindegård", "Kildevæld", "Røsnæs", "Tangholm", "Sandbjerg", "Bakkely",
  "Fyrtårn", "Nørrevang", "Østerled", "Sønderå", "Vestervig", "Højbo", "Kornmark", "Isbjerg", "Pilevang", "Ravnsø",
  "Ørnereden", "Bøgely", "Marsk",
];

const BRANCHE_EFTERLED = {
  "Food & Beverage": ["Fødevarer A/S", "Mejeri A/S", "Bryggeri ApS", "Slagteri A/S", "Bageri A/S", "Konserves ApS", "Fisk A/S", "Drikke A/S"],
  "Manufacturing": ["Industri A/S", "Maskinfabrik A/S", "Plast ApS", "Metal A/S", "Stålværk A/S", "Komponenter ApS"],
  "Service": ["Service A/S", "Facility ApS", "Drift A/S"],
  "Energy & Utilities": ["Energi A/S", "Forsyning A/S", "Fjernvarme A.m.b.a."],
  "Chemical Processing": ["Kemi A/S", "Coatings ApS"],
  "Consumer Products": ["Husholdning A/S", "Design ApS"],
  "Aerospace / Airline": ["Aviation A/S", "Air Service ApS"],
  "Transportation": ["Transport A/S"],
  "Electronics": ["Elektronik A/S"],
  "Defense": ["Defence Systems A/S"],
  "Consulting": ["Rådgivning ApS"],
  "Cargo Handling": ["Terminal A/S"],
  "Aquaculture": ["Akvakultur P/F"],
};

const DK_BYER = [
  ["8700", "Horsens"], ["7100", "Vejle"], ["8000", "Aarhus C"], ["5000", "Odense C"], ["9000", "Aalborg"],
  ["6000", "Kolding"], ["6700", "Esbjerg"], ["7400", "Herning"], ["8600", "Silkeborg"], ["8900", "Randers C"],
  ["4000", "Roskilde"], ["4700", "Næstved"], ["6400", "Sønderborg"], ["7500", "Holstebro"], ["9850", "Hirtshals"],
  ["7700", "Thisted"], ["8800", "Viborg"], ["6200", "Aabenraa"], ["4200", "Slagelse"], ["2600", "Glostrup"],
];
const FO_BYER = [["100", "Tórshavn"], ["700", "Klaksvík"], ["620", "Runavík"], ["510", "Gøta"], ["800", "Tvøroyri"]];

const VEJE = ["Industrivej", "Fabriksvej", "Havnegade", "Erhvervsvej", "Mølleparken", "Teknikervej", "Smedevej", "Kornvej", "Strandvejen", "Lagervej"];
const FO_VEJE = ["Vestara Bryggja", "Hoyvíksvegur", "Á Bakka", "Niels Finsens gøta", "Stangavegur"];

const DK_FORNAVNE = ["Mette", "Lars", "Sanne", "Henrik", "Camilla", "Morten", "Louise", "Søren", "Trine", "Jesper", "Pernille", "Kasper",
  "Rikke", "Anders", "Helle", "Thomas", "Line", "Martin", "Birgitte", "Rasmus", "Dorthe", "Mikkel", "Charlotte", "Jacob"];
const DK_EFTERNAVNE = ["Holm", "Kjær", "Lund", "Dahl", "Bech", "Krog", "Vestergaard", "Bisgaard", "Thygesen", "Holmgaard", "Ravn", "Bundgaard",
  "Skov", "Brix", "Lauritsen", "Mørch", "Fogh", "Graversen"];
const FO_FORNAVNE = ["Rógvi", "Sjúrður", "Turið", "Jóannes", "Bára", "Heðin", "Sunnvá"];
const FO_EFTERNAVNE = ["Joensen", "Poulsen", "á Rógvu", "Dam", "í Líð", "Olsen"];

const TITLER = ["Vedligeholdelseschef", "Teknisk chef", "Driftsleder", "Planlægger", "Produktionschef", "Teknisk koordinator", "Vedligeholdelsesplanlægger"];

/** Simpel deterministisk "tilfældighed" ud fra et tal. */
function rnd(seed) {
  let x = (seed * 2654435761) >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}
const vaelg = (r, liste) => liste[Math.floor(r() * liste.length)];

export function slug(s) {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").replace(/ð/g, "d").replace(/[áíóúý]/g, (c) => "aiouy"["áíóúý".indexOf(c)])
    .replace(/a\/s|aps|a\.m\.b\.a\.|p\/f/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

/** Et fiktivt firma. i bestemmer identiteten (0, 1, 2 …). */
export function fiktivFirma(i, { industry, country } = {}) {
  const r = rnd(i + 101);
  const fo = country === "Færøerne";
  const forled = FORLED[i % FORLED.length] + (i >= FORLED.length ? ` ${Math.floor(i / FORLED.length) + 1}` : "");
  const efterled = vaelg(r, BRANCHE_EFTERLED[industry] ?? ["Industri A/S"]);
  const navn = `${forled} ${fo ? efterled.replace(/A\/S|ApS/, "P/F") : efterled}`;
  const [postnr, by] = vaelg(r, fo ? FO_BYER : DK_BYER);
  const vej = `${vaelg(r, fo ? FO_VEJE : VEJE)} ${1 + Math.floor(r() * 80)}`;
  const s = slug(forled) || `firma${i}`;
  return {
    navn,
    slug: s,
    vej,
    postnr,
    by,
    adresse: `${vej}, ${postnr} ${by}`,
    cvr: `99${String(100000 + i * 7919).slice(-6)}`,
    mail: `info@${s}.example`,
    web: `https://www.${s}.example`,
    telefon: `+45 00 00 ${String(10 + (i % 90)).padStart(2, "0")} ${String(10 + ((i * 7) % 90)).padStart(2, "0")}`,
    kontonr: String(900000 + i),
    kode: `D${String(1000000 + i * 137).slice(-7)}`,
  };
}

/** En fiktiv kontaktperson. j skelner mellem flere kontakter på samme kunde. */
export function fiktivPerson(i, j = 0, { country, firmaSlug } = {}) {
  const r = rnd(i * 31 + j + 7);
  const fo = country === "Færøerne";
  const fornavn = vaelg(r, fo ? FO_FORNAVNE : DK_FORNAVNE);
  const efternavn = vaelg(r, fo ? FO_EFTERNAVNE : DK_EFTERNAVNE);
  const mailNavn = `${slug(fornavn)}.${slug(efternavn)}`;
  return {
    fornavn,
    efternavn,
    navn: `${fornavn} ${efternavn}`,
    titel: vaelg(r, TITLER),
    mail: `${mailNavn}@${firmaSlug ?? "kunde"}.example`,
    telefon: `+45 00 00 ${String(20 + ((i + j * 13) % 80)).padStart(2, "0")} ${String(30 + ((i * 3 + j) % 70)).padStart(2, "0")}`,
  };
}
