# Ændringer i CRM-Pro (oktober 2026)

Alt herunder er bygget oven på CRM-Pro 1.0.2. Den nyeste udgave kører på Vercel med Postgres (Neon).
Opsætning og flytning af data står i `README.md`.

## Tilstandslog, intern salg og licensbevis pr. ordre (29. oktober 2026)

- **Tilstandslog** under *Kundens tilstand*.
  - Tryk **+**, så står `29/10/26 JPR: ` klar, og du skriver bare videre.
  - Hurtigtekster sættes ind med ét klik.
  - Hver gemt linje er sin egen post, nyeste øverst, én linje pr. post. De samme linjer står i Logbogen.
  - Skift af tilstand logges automatisk ("Tilstand: Stabil → Risiko").
  - Den nyeste linje vises under kundens navn.
- **Indstillinger → Salg → Log skrivning:** hurtigteksterne kan tilføjes, rettes, skjules, sorteres og slettes.
- **Klar til intern salg** (nyt menupunkt) og **ny rolle "Intern salg"**.
  - En ordrebekræftelse sendes videre med *Send til intern salg*.
  - Forløb: Pending → Bestilt → Afventer leverandør → Klar til kunde → Leveret & afsluttet. Hvert trin har sit tidspunkt og logges på kunden.
  - Leverede ordrer ligger i deres egen pulje med datofilter.
  - Intern salg udfylder leverandørens ordrenr. samt leverandør-ref., placering, part # og version pr. licens.
- **Licensbevis pr. produkt** fra *Klar til kunde*:
  - Licensnr. er ordrenummeret, med leverandør-ref., placering, detaljer, SUB-nr., periode og pris for perioden samt subscription-aftalen.
  - Beviset gemmes i filboksen og noteres i logbogen.
- **Dashboard → Leveringer:** antal, værdi og kunder for leverede ordrer.
  - Faste perioder: denne måned, sidste måned, dette kvartal, i år og seneste 12 mdr.
  - Du kan også vælge egne datoer.
- **Database (lægges på automatisk):**
  - Nye felter til intern salg på `orders` og licensdata på `order_lines`.
  - Ny tabel `log_skabeloner`.

## Backend-gennemgang (29. oktober 2026)

Se `BACKEND.md` for opbygning, mapper og regler.

- **Fil-download virkede ikke i produktionen.** `.gitignore` udelukkede alle mapper med navnet `filer/`, så `/api/filer/[id]` aldrig blev committet.
  - Ruten er genskabt med adgangskontrol og `nosniff`. Kun PDF og billeder vises direkte; andre filer (fx uploadet HTML) hentes som download.
  - `.gitignore` er rettet, så mønstrene kun gælder roden.
- **Formularer:** al læsning sker via `lib/formular.ts`.
  - Dansk talformat (`1.250,50`) tolkes nu ens overalt. Før blev `1.250` til 1,25 i kunder, salg og teknik.
  - Datoer gemmes som lokal middag, så de ikke forskydes af tidszoner.
  - Status, prioritet, stadie, logtype, faktureringsinterval, beslutningsrolle og kundestatus valideres mod de faste lister.
  - Web-adresser accepteres kun som http(s).
- **Nummerserier:** TIL-, ORD-, SAG- og KK-numre er sikre ved samtidige oprettelser (`lib/nummerserie.ts`). Før kunne to oprettelser i samme sekund give en fejl.
- **Transaktioner:**
  - Tid og klippekortets forbrug.
  - Sletning af klippekort.
  - Sletning af produkt med linjer.
  - Licenslinje og SUB-nøgle.
  - Flytning af notater.
- **Dataintegritet:**
  - En licensændring husker den præcise linje, den ramte (`customerProductId`), så *Fortryd* rammer rigtigt, selv om kunden har licensen på flere SUB-nøgler.
  - Tid, kontakt, klippekort og sag kontrolleres for at tilhøre samme kunde.
  - En sags løst- og lukket-dato bevares, når sagen gemmes igen.
  - Sletter man en sag, bliver tiden stående på kunden og klippekortet.
- **Ydelse:**
  - Indeks på alle fremmednøgler.
  - Sessionen slås op én gang pr. forespørgsel.
- **Adgang:** PDF-ruterne kræver læseadgang til salg. Optællingen af demodata kræver superadministrator.
- **Oprydning:**
  - Fem ubrugte server actions er fjernet. De var unødig angrebsflade.
  - Den gamle demodata-indlæser er fjernet. Det nye demomiljø erstatter den.
  - Alle `as any` er fjernet.
  - Ubrugte hjælpefunktioner er fjernet.

## Demomiljø og produkter i kundelisten (29. oktober 2026)

- **Indstillinger → Demomiljø:**
  - **Trin 1:** *Hent backup (JSON)*. Backuppen indeholder alle kunder, katalog, ordrer og filboksens filer.
  - **Trin 2:** sæt flueben og vælg *Byg demomiljø*. Den sletter alle kunder og bygger 6 nye, fiktive kunder (4 danske og 2 færøske), hvor intet er ens.
  - Hver kunde får mindst 2 af alt:
    - Kontakter og SUB-nøgler.
    - Abonnementer og perpetual-licenser, med licenshistorik.
    - Salgsmuligheder i forskellige stadier og aktiviteter.
    - Sager med kommentarer og tid, klippekort, notater og logbog.
    - Filer: kontrakt, mødereferat og plan.
    - Tilbud: et tilkøbstilbud med restpris og et fornyelsestilbud, med status åben, godkendt eller afvist. Godkendte tilbud har accept og ordre.
    - Ordrer: en opstartsordre og en ydelsesordre.
    - Salesforce-links.
  - **8 fiktive produkter ved siden af Idus**, i alt 22 licenser og ydelser med to priser i prishistorikken:
    - Vektor Asset, Pulsar Monitor, Lagerfyr, Planbro, Rundtur Mobile, Dokumentdok og Energispor.
    - Konsulentydelser: implementering, kursus, rejse, projektledelse, datamigrering og integration.
  - Brugere, indstillinger og eksisterende licenser røres ikke. Hver kørsel giver nye, tilfældige data.
- **Kundeliste og dashboard:**
  - Kolonnen *Pakke* er erstattet af *Produkter*: én mærkat pr. produkt med antal licenser.
  - Filteret finder kunder med produktet, og *Uden produkter* er et nyt valg.
  - Diagrammet *Licenser pr. licenstype* viser kun licenser i brug, uden ydelser.
  - Perpetual-licenser tæller ikke længere som "uden pris".

## SUB-nøgler, tilkøb med restpris og godkendelse af tilbud (28. oktober 2026)

- **SUB-nøglen er kontrakten.** Én nøgle (SUB-00001) kan rumme flere licenser. Under Produkter vises
  kundens licenser grupperet under nøglen med udløb, licensbevis, knappen **Tilkøb** og nøglens tilbud
  og ordrer. Udløbet er det seneste udløb blandt nøglens abonnementer. Har licenserne forskellige
  udløb, vises en advarsel.
- **Eksisterende data:** hver gammel licenslinje får sin egen nøgle og beholder sit SUB-nummer, første
  gang kunden åbnes. Linjer slås sammen under én nøgle ved at vælge nøglen på linjen
  (feltet *SUB-nøgle*). Tomme nøgler fjernes automatisk.
- **Tilkøb med restpris:** *Tilkøb* på en nøgle åbner et tilbud, hvor prisen regnes fra startdatoen
  til nøglens udløb. Påbegyndte måneder tæller som hele. Prisen er nøglens aftalte pris (ellers
  listepris) og kan rettes. Serveren regner perioden igen, så tilbuddet altid følger nøglen.
  Eksempel: 3 licenser til 450 kr./md., udløb 31.03.2027. Tilkøb af 1 den 28.10.2026 giver
  1 × 450 × 6 mdr. = 2.700 kr.
- **Godkendelse:** et tilbud har status *Afventer kunden*, *Godkendt* eller *Afvist*.
  *Markér som godkendt* tager kundens accept som bilag (PDF, .msg, .eml, billede; højst 4 MB).
  Bilaget gemmes i filboksen under den nye kategori **Accepter**, og det knyttes til tilbuddet.
  Med flueben laves ordrebekræftelsen samtidig, og licenserne lægges på nøglen.
- **Salesforce:** tilbud og ordrer har et felt til linket til Opportunity'en. Linket følger med fra
  tilbud til ordre og vises på ordren, i ordrelisten og på nøglen. Kun https-adresser accepteres.
- **Database (lægges på automatisk ved udrulning):** ny tabel `contracts`. Nye felter:
  `customer_products.contractId` samt `status`, `acceptedAt`, `acceptedBy`, `acceptAttachmentId`,
  `salesforceUrl` og `contractId` på `orders`. Der slettes ingen data.

## Glossy glas-design (28. oktober 2026)

- **Nyt udtryk:** iPhone-agtigt klart glas på kort, sidebjælke, topbar, bundmenu og dialoger —
  glanskuppel foroven, lys refleks-kant, lagdelte kolde skygger. Hjørner "blank is": 4 px på
  knapper og felter, 8 px på kort.
- **Lyst og mørkt tema** bygget på samme tokens (globals.css). Mørkt: grafitblå bund, dæmpet glans,
  lyse kanter, sorte skygger; signalfarver (grøn/gul/rød/blå) skifter med temaet.
- **Indstillinger → Udseende (ny):** vælg en meget svag baggrund under hele appen — Ingen, Isblå
  aurora, Isflager, Dybt hav eller eget billede (JPG/PNG/WebP, højst 3 MB). Styrke 0–60 % med
  forvalg Svag/Middel/Tydelig, valgfrit på mobil. Live forhåndsvisning; gemmes for alle brugere.
  Nye felter på Settings: `bgPattern`, `bgStrength`, `bgImage`, `bgMobile` (lægges på automatisk
  ved udrulning via `prisma db push`).
- **Rettelser fra designgennemgangen:** tydelige søge- og indtastningsfelter (brønd med kant og blå
  fokusring), sekundærknapper med synlig kant, faner som glas-piller i et fordybet spor, primærknap
  med kontrast 5,6:1, Hot-mærke 4,6:1, fokusmarkering ved tastatur, nøgletal vipper let ved hover,
  glossy skyder, diagrammer i blå/grøn, svævende bundmenu på mobil, ingen blur på kort på mobil
  (ydelse), respekt for "reducer gennemsigtighed/bevægelse".

## Mobil og anonymisering (19. oktober 2026)

- **Mobil:** fast bundmenu (Overblik, Kunder, Salg, Sager, Menu) og en menuskuffe med resten,
  nøgletal i to kolonner, lister som kort, faner og filtre der ruller vandret, 16 px felter
  (ingen iOS-zoom), safe-area til notch/hjem-linje og "Føj til hjemmeskærm" (manifest + ikon).
- **Anonymisering:** ingen henvisninger til den tidligere forhandler i kode, standardbetingelser eller
  pladsholdere. Betingelserne bruger nu den neutrale part *the Supplier* / *leverandøren*.
  `scripts/anonymiser.mjs` kører ved hver udrulning (`vercel-build`) og retter data der allerede
  ligger i databasen: afsenderprofiler, dokumentoplysninger, gemte betingelser og alle øvrige
  tekstfelter. Brugerne røres ikke. Kan også køres lokalt med `npm run db:anonymiser`.

## 1. Katalog: produkt → licenser (kun superadmin)

- **Indstillinger → Katalog** med to niveauer: produkter (fx *Idus*) og licenserne under dem
  (fx *Idus Online Basic / Professional / Enterprise*).
- Licensmodel pr. licens: **Subscription** (pris pr. bruger pr. måned, tæller med i årsværdien) eller
  **Perpetual** (engangspris pr. licens, tæller ikke med i løbende årsværdi).
- **Prisændringer med historik:** ny pris med "gælder fra"-dato. Dags dato slår igennem straks, en
  fremtidig dato venter og træder automatisk i kraft. Planlagte ændringer kan annulleres.
  Kunder med aftalt pris berøres ikke.
- Pr. produkt: **kommercielle betingelser** og **generelle betingelser (T&C)**. Idus er forudfyldt med
  standardteksterne. Linjen "Gyldighed" vises kun på tilbud.
- Pr. licens: **tekst på tilbud og ordrebekræftelser** (beskrivelsen under positionen).
- Salg → Produkter er nu kun til at se; redigering sker i Katalog.

## 2. Tilkøb af licenser

- Kort på kunden: **Tilkøb og licensændringer** — licens, tilkøb/reduktion, antal, dato, pris, note.
  Licensantallet opdateres, og posten gemmes i historik og logbog. Administrator kan fortryde.
- **Salg → Tilkøb:** overblik pr. år og produkt — tilkøbte og reducerede licenser, ny årsværdi,
  engangsbeløb, netto pr. måned og pr. licens.

## 3. Roller: superadministrator

- Ny rolle **superadmin** over admin og bruger. Hele Indstillinger kræver superadmin og er skjult for andre.
- Der skal altid være mindst én aktiv superadmin. Den ældste aktive administrator blev gjort til superadmin
  ved opgraderingen.

## 4. Licensbevis (PDF)

- Hver licenslinje har et fast **licensnummer SUB-00001** osv.
- Licensbevis for hele kunden, ét produkt eller én linje, med flueben pr. produkt og licens.
- Perioden foreslås ud fra aftalens start og aftaleperiode og kan rettes. Perpetual står som tidsubegrænset.
- Kopi gemmes i kundens filboks under *Licensbeviser*.

## 5. Tilbud og ordrebekræftelser (PDF)

- **Salg → Tilbud og ordrer** med egne nummerserier: **TIL-00001** og **ORD-00001**.
- Kan laves med eller uden kunde. Fra en kunde forudfyldes modtager, Att., aftalte priser og antal;
  produkter og licenser vælges med flueben (helt produkt eller enkelte licenser) + frie positioner.
- Tilbud har "gyldigt til" (standard 30 dage). **Lav ordrebekræftelse** ud fra et accepteret tilbud.
- **Periodeberegner pr. linje:** startdato, antal måneder og slutdato regnes ud fra hinanden
  (påbegyndt måned tæller som hel), knapper til 12/24/36 måneder og
  **Synk til aftalen / Synk + næste periode**, så en ekstra licens følger kundens løbetid (fx 13–14 mdr.).
- "Opdatér kundens aftaler": fornyelser flytter aftalens udløb, nye licenser registreres som tilkøb.
- PDF-layout som en klassisk dansk ordreskabelon: modtager til venstre, sælger/afdeling/ref./ordre- og tilbudsnr./
  dato/side til højre, indledning med pladsholdere (%KUNDENAVN%, %KONTAKTPERSON%, %BRUGERENS NAVN%),
  positioner med beskrivelse, periode og "Pris netto pos. N", samlet nettopris, kommercielle
  betingelser, hilsen og T&C på egne sider. Brevfod i tre kolonner, logo på hver side.
- PDF gemmes i kundens filboks (*Tilbud* / *Ordrebekræftelser*) og noteres i logbogen.

## 6. Aftaler og fornyelser

- Licenslinjen har **aftaleperiode** (12/24/36 mdr.) og **aftale udløber**. Uden udløbsdato beregnes den.
- **Lav fornyelse** pr. linje og **Forny <produkt>** på kunden: ordren dannes fra dagen efter udløb og en
  aftaleperiode frem med kundens antal og pris.
- **Salg → Fornyelser:** aftaler der udløber inden for 30–365 dage, med årsværdi på spil og genveje.

## 7. Indstillinger → Dokumenter (kun superadmin)

- Afsender, afdeling, CVR, adresse, kontakt, bankoplysninger (brevfod), betalingsbetingelser og
  standardtekster. Brugere har nu også mobilnummer (står i dokumenthovedet).

## 8. Vercel-udgaven

- Postgres (Neon) i stedet for SQLite; tabeller lægges ud ved hvert deploy (`prisma db push`).
- Filboksens filer gemmes i databasen (maks. 4 MB pr. fil).
- Electron/exe, lokal databasefil, databaseflytning og opdateringstjek er fjernet.
- **Sikkerhed:** `middleware.ts` kræver gyldig, signeret login-cookie for alle sider, handlinger og API'er;
  alle server actions tjekker brugeren; 5 forkerte PIN i træk spærrer i 15 minutter; `AUTH_SECRET` fra
  miljøet; førstegangsopsætning kræver `OPSAETNINGSKODE` i produktion.
- **Indstillinger → Eksport:** hele databasen som JSON (med eller uden filer).
- **Flyttescript** `npm run db:flyt -- "<crm-pro.db>"` flytter alt fra den lokale database til Postgres.

## 9. Fiktive kundedata

- `npm run db:flyt -- "<crm-pro.db>" --fiktiv` gør alle kundedata fiktive undervejs: firmanavne,
  adresser, CVR, kontonumre, subdomæner, mail, telefon og kontaktpersoner erstattes; navne, mails og
  telefonnumre i fritekst skiftes ud; størrelsestal sløres; filboksens filer springes over.
  Licenser, priser, branche, land og historik bevares.
- `npm run db:seed` lægger **43 fiktive demokunder** ind (`prisma/demo-kunder.json`) med samme
  branchefordeling, lande og licensantal som porteføljen.
- Mail/web bruger `.example`, telefon `+45 00 00 xx xx`, CVR starter med 99 — intet rammer rigtige
  virksomheder eller personer.

## Kendte punkter

- T&C-teksten for Idus er indsat ordret og indeholder to fejl fra originalen: overskriften
  "3. rice and Payment" og et tomt punkt 14.6. Ret dem under Katalog → Idus.
- Fakturering sker uden for CRM-Pro; ordrebekræftelsen er fakturagrundlaget.
