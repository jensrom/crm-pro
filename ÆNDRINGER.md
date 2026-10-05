# Ændringer i CRM-Pro (oktober 2026)

Alt herunder er bygget oven på CRM-Pro 1.0.2. Den nyeste udgave kører på Vercel med Postgres (Neon).
Opsætning og flytning af data står i `README.md`.

## 1. Katalog: produkt → licenser (kun superadmin)

- **Indstillinger → Katalog** med to niveauer: produkter (fx *Idus*) og licenserne under dem
  (fx *Idus Online Basic / Professional / Enterprise*).
- Licensmodel pr. licens: **Subscription** (pris pr. bruger pr. måned, tæller med i årsværdien) eller
  **Perpetual** (engangspris pr. licens, tæller ikke med i løbende årsværdi).
- **Prisændringer med historik:** ny pris med "gælder fra"-dato. Dags dato slår igennem straks, en
  fremtidig dato venter og træder automatisk i kraft. Planlagte ændringer kan annulleres.
  Kunder med aftalt pris berøres ikke.
- Pr. produkt: **kommercielle betingelser** og **generelle betingelser (T&C)**. Idus er forudfyldt med
  Novoteks tekster. Linjen "Gyldighed" vises kun på tilbud.
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
- PDF-layout som Novoteks ordreskabelon: modtager til venstre, sælger/afdeling/ref./ordre- og tilbudsnr./
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
