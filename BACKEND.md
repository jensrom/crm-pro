# CRM-Pro — backend

Sådan er backend bygget, og hvor du finder hvad. Læs den, før du ændrer i
databasen, handlingerne eller adgangskontrollen.

## Stak

| Lag | Teknologi |
| --- | --- |
| Web og server | Next.js 15 (App Router, server components, server actions) |
| Database | Postgres hos Neon via Prisma 6 |
| Hosting | Vercel. `vercel-build` kører `prisma generate`, `prisma db push`, anonymiseringen og `next build` |
| PDF | pdf-lib (ren JavaScript) |

Skemaet lægges på med `prisma db push` ved hver udrulning. Derfor må en
ændring i `prisma/schema.prisma` kun **tilføje** (nye tabeller, nullable
felter, felter med standardværdi, indekser). Omdøbning eller sletning af en
kolonne med data kræver en manuel migrering. Ellers fejler udrulningen, og
det er med vilje.

## Mapper

```
prisma/schema.prisma   Datamodellen — én kommentar pr. felt, der ikke er selvforklarende
middleware.ts          Port foran alt: kræver gyldig, signeret login-cookie (undtagen login/opsætning)
app/actions/*.ts       Server actions — alt der skriver. Én fil pr. område (se nedenfor)
app/api/**/route.ts    Downloads: PDF'er, filer, eksport, backup, baggrundsbillede
app/(app)/**           Siderne. Læser data direkte med Prisma; skriver kun via actions
lib/                   Domænelogik og fælles hjælpere (ingen UI)
components/            UI. Ingen databasekald
scripts/               Engangs- og vedligeholdelsesscripts (seed, klargøring, anonymisering)
```

### Server actions (`app/actions`)

| Fil | Område |
| --- | --- |
| `auth.ts` | Login, logud, førstegangsopsætning, brugere og PIN |
| `kunder.ts` | Stamdata, tilstand, Hot, licenslinjer og SUB-nøgler, kontakter |
| `tilkoeb.ts` | Tilkøb og reduktion af licenser med historik |
| `ordrer.ts` | Tilbud og ordrebekræftelser, godkendelse, Salesforce-link |
| `salg.ts` | Salgsmuligheder, aktiviteter, pipeline-indstilling |
| `teknik.ts` | Sager, kommentarer, klippekort, tid og logbog |
| `notater.ts` | Opgavetavlen |
| `filer.ts` | Filboksen |
| `katalog.ts` / `produkter.ts` | Produkter, licenser, varenumre, priser, arkivering og sletning |
| `indstillinger.ts` / `demodata.ts` | Indstillinger, udseende, afsendere, demomiljø |

### Domænelogik (`lib`)

| Fil | Indhold |
| --- | --- |
| `auth.ts`, `sessionkiks.ts`, `roller.ts` | Session, roller og rettigheder (`kraevSkriv("salg")` osv.) |
| `db.ts` | Prisma-klienten. Stempler automatisk `updatedBy` på de modeller der har feltet |
| `formular.ts` | **Al** læsning af formularfelter: tekst, dansk talformat, datoer og faste valglister |
| `nummerserie.ts` | Fortløbende numre (TIL/ORD/SAG/KK) med sikker håndtering af samtidige oprettelser |
| `kontrakter.ts` | SUB-nøgler: nummerering, udløb og restperiode |
| `licenser.ts` | Én licensændring: flytter antal og skriver historik og logbog |
| `ordre-anvend.ts` | Lægger en ordre over på kundens licenser |
| `perioder.ts` | Datoregning for aftaleperioder (ren logik, bruges også i browseren) |
| `varenummer.ts` | Varenumre genereret af navn og altid unikke |
| `katalog.ts`, `pricing.ts`, `analysis.ts` | Katalog, priser og nøgletal |
| `pdf.ts`, `ordre-pdf.ts`, `dokumenter.ts` | Licensbevis, tilbud og ordrer som PDF |
| `demomiljoe.ts` | Bygger demomiljøet |
| `labels.ts` | Faste værdier (statusser, stadier, roller) og deres danske navne |

## Regler alle handlinger følger

1. **Adgang først.** Hver eksporteret server action starter med et `kraev…()`-kald. Hver API-rute tjekker session og rolle. Middleware er kun det yderste lag.
2. **Formularer læses kun gennem `lib/formular.ts`.** Tal tolkes dansk (`1.250,50`). Datoer gemmes som lokal middag. Faste værdier som status, prioritet og stadie valideres mod listerne i `lib/labels.ts`, så der aldrig kommer ukendte værdier i databasen.
3. **Flere skrivninger, der hører sammen, ligger i én transaktion**, fx tid og klippekortets forbrug, sletning af et produkt med dets linjer, eller en licensændring med historik.
4. **Relationer kontrolleres.** En kontakt, et klippekort eller en sag, der kobles på en kunde, skal tilhøre samme kunde.
5. **Nummerserier oprettes med `medLoebenummer`.** Det er aldrig `max + 1` direkte.
6. **Sletning sker med bekræftelse i UI** (`BekraeftSlet`). Data, der bærer historik (tid, ordrer), slippes fri frem for at forsvinde.
7. **Filer** gemmes i databasen (bytea). Downloads sendes med `nosniff`, og kun PDF og billeder vises direkte i browseren.
8. **Hvem gemte hvad:** `updatedBy` stemples automatisk af `lib/db.ts`. Forfatterfelter (`author`, `createdBy`) sættes eksplicit fra sessionen.

## Datamodel i hovedtræk

```
Company ─┬─ Contact
         ├─ Contract (SUB-nøgle) ── CustomerProduct (licenslinje) ── Product ── ProductFamily
         │                                │                             └── ProductPrice (prishistorik)
         │                                └── LicenseChange (tilkøb/reduktion)
         ├─ Order (tilbud/ordre) ── OrderLine
         ├─ Deal (salgsmulighed) ── Activity
         ├─ Ticket (sag) ── TicketComment, TimeLog ── HourBundle (klippekort)
         ├─ CustomerNote, LogEntry, Attachment
User ── SenderProfile        Settings (én række, id = "singleton")
```

Alle fremmednøgler har et indeks. Kunden er roden. Sletter du en kunde, går
alt med, undtagen tilbud og ordrer, som bliver stående som dokumenter.

## Typiske opgaver

- **Nyt felt på en model:** tilføj det nullable eller med en standardværdi i `schema.prisma`, med en `///`-kommentar. Læs det i actionen med `formular()`. Udrulningen lægger det på.
- **Ny fast værdi (fx en ny sagsstatus):** tilføj den i `lib/labels.ts`. Validering og visning følger automatisk med.
- **Ny server action:** start med `kraev…()`, læs med `formular(formData)`, skriv i en transaktion, hvis der er mere end én skrivning, og afslut med `revalidatePath`.
- **Ny nummerserie:** brug `medLoebenummer(naeste, opret)` og et `@unique` i skemaet.
