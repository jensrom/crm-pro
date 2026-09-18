# CRM-Pro

Lokalt CRM over de danske og færøske Idus Online-kunder — deres stamdata, firmastørrelse,
produktpakker, pladser, salgsmuligheder og historik.

Bygget på samme fundament som CRM-X (Next.js 15, Prisma, Tailwind, samme Nordic-designsystem),
men uden multi-tenant, login og betaling. Databasen er én SQLite-fil i projektmappen, så der er
ingen sky, ingen server og ingen konto involveret.

## Log ind

Første gang programmet åbnes er der ingen brugere. Du bliver sendt til en opsætningsside og opretter
den første bruger, som automatisk bliver administrator. Derefter logger man ind med **initialer og PIN**.

PIN'en gemmes som en scrypt-hash med eget salt — den kan ikke læses ud af databasen igen, kun nulstilles
af en administrator. Bemærk at PIN-koden spærrer *programmet*, ikke databasefilen: den der har adgang til
.db-filen kan læse indholdet direkte.

Alt under **Indstillinger** er forbeholdt administratorer.

## Kom i gang

Kræver Node 18 eller nyere.

```powershell
npm install
npm run setup      # genererer klient, opretter databasen og indlæser de 43 kunder
npm run app        # åbn http://127.0.0.1:3000
```

`npm run setup` kan køres igen uden at lave dubletter — den opdaterer eksisterende kunder.

## Portabel exe

`npm run dist` bygger programmet som en enkelt Windows-exe uden installation.
Se **PORTABEL.md** for fremgangsmåde, datamappe og sikkerhedskopiering.

## Kommandoer

| Kommando | Hvad den gør |
|---|---|
| `npm run app` | **Daglig brug.** Bygger og starter appen — hurtig, ingen kompilering undervejs |
| `npm start` | Starter en allerede bygget app med det samme |
| `npm run dev` | Udviklingstilstand med hot reload. Kun når du ændrer kode — den er langsom |
| `npm run build` / `npm start` | Produktionsbuild og -kørsel |
| `npm run db:upgrade` | Opdaterer databasens struktur og indlæser data — brug efter en opdatering af projektet |
| `npm run db:seed` | Indlæser eller opdaterer de 43 kunder fra `data/kunder.json` |
| `npm run db:reset` | Tømmer databasen og indlæser forfra — **sletter dine egne noter** |
| `npm run db:studio` | Prisma Studio, hvis du vil se rådata |
| `npm run dist` | Bygger den portable Windows-exe (se PORTABEL.md) |
| `npm run typecheck` | TypeScript-kontrol |

## Det du kan

- **Dashboard** — licenser, udnyttelse, årlig licensværdi, største kunder, åbne sager
- **Kunder** — alle 43 med filtre på land, branche og prioritet, sortering på hver kolonne
- **Kundeside** — stamdata, firmastørrelse med kilde, pakke og licenser, kontakter, sager, historik
- **Kundenotater** — en tavle med fire kolonner (Nu, Næste, Venter, Færdig). Kortene trækkes mellem
  kolonnerne, kan prioriteres, mærkes Salg eller Teknik, hænges på en kunde og krydses af
- **Kontakter** — alle kontaktpersoner på tværs af kunderne
- **Pipeline** — sager i seks stadier, flyt dem videre med ét klik
- **Produkter** — opret, omdøb, prissæt og arkivér produkter selv; giv hvert produkt et mærke og en farve
  (guld, sølv, bronze m.fl.); vælg et produkt og se kunderne på det; flyt én kunde ad gangen eller sæt
  flueben og flyt flere på én gang
- **Aktiviteter** — opgaver og opfølgning med forfaldsdato
- **Teknik** — sager med prioritet, status, noter og tidsregistrering; klippekort med forbrug og rest
- **Indstillinger** (kun administratorer) — *Generelt*, *Brugere*, *Whitelabel* med logo og undertekst,
  *Produkter* med sletning og arkivering, og *Database* hvor filens placering vælges

## Datagrundlag

Pladser og stamdata kommer fra Idus Online-partnerportalen, status Paid, 26. august 2026.
Antal ansatte og omsætning er slået op i CVR via proff.dk, estatistik.dk og ownr.dk samt
årsrapporter — kilde-URL står på hver enkelt kunde.

## Sådan regnes tallene

**Budget bygger kun på nuværende licenser.** Årsværdi = tildelte licenser × aftalt pris pr. bruger
pr. måned × 12. Pakkerne er Small 330 kr., Medium 550 kr. og Large 695 kr. pr. bruger pr. måned;
en kunde kan have en aftalt pris der slår listeprisen.

**Firmastørrelse er baggrundsviden.** Antal ansatte og omsætning står på kunden så du ved hvor stor
en virksomhed du sidder med. De indgår hverken i pris, pakkevalg eller scope.

**Scope bestemmer du.** Appen opretter ingen salgsmuligheder og foreslår ingen udvidelser. Vælger du
pakke og antal licenser på en sag, regner den årsværdien ud fra pakkens pris — men antallet er dit.

## Hvor databasen ligger

Som standard `prisma/crm-pro.db`. Placeringen kan ændres under **Indstillinger → Database** og gemmes i
`crm-pro.config.json` i projektmappen — ikke i databasen, af gode grunde. Ændringen træder i kraft ved
næste opstart, og `npm run db:upgrade` følger automatisk med til den nye placering.

**Læg den aldrig i en synkroniseret mappe.** OneDrive, SharePoint, Dropbox og lignende kopierer filen
mens den bliver skrevet, og en SQLite-database overlever det ikke. Programmet advarer hvis stien ser
sådan ud.

**Netværksdrev virker, men med forbehold.** SQLites fillåse er upålidelige over SMB. Én åben ad gangen,
og tag hyppige kopier. Skal I være flere om de samme data, er den sikre vej at lade programmet køre på
én maskine og lade de andre åbne adressen i browseren.

## Sikkerhedskopi

Databasefilen er hele sikkerhedskopien — kunder, sager, brugere og logo. Luk appen og kopiér den.

## Mappestruktur

```
app/(app)/        sider — dashboard, kunder, kontakter, pipeline, produkter, aktiviteter, indstillinger
app/actions/      server actions, al skrivning til databasen
components/ui/    knapper, badges, felter, kort — arvet fra CRM-X
components/       layout, diagrammer, kundeliste
lib/              database, formatering, etiketter, beregninger
prisma/           schema og seed-script
data/kunder.json  de 43 kunder med alt researchet data
```
