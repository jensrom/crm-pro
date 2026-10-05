# CRM-Pro

CRM over Idus Online-kunderne: salg og teknik i ét værktøj. Kunder, licenser og tilkøb, katalog,
tilbud, ordrebekræftelser, fornyelser, licensbeviser, sager, klippekort, logbog og notater.

Kører på **Vercel** med **Postgres hos Neon**. Next.js 15 · Prisma 6 · Tailwind.

---

## Sæt det op på Vercel (første gang)

### 1. Læg koden på GitHub

Opret et **privat** repository på GitHub (fx `crm-pro`), og push koden fra projektmappen
(i en almindelig Windows-terminal):

```bash
git init -b main
git add .
git commit -m "CRM-Pro klar til Vercel"
git remote add origin https://github.com/<dit-brugernavn>/crm-pro.git
git push -u origin main
```

`.gitignore` sørger for, at `.env`, `node_modules` og mappen `data/` (med de rigtige kunder) ikke kommer med.

### 2. Opret projektet i Vercel

1. vercel.com → **Add New… → Project** → vælg repositoryet → **Import**.
2. Framework: **Next.js** (findes automatisk). Lad build-indstillingerne stå — `vercel-build` i
   `package.json` bruges automatisk.
3. Tryk **ikke** Deploy endnu, hvis du får muligheden for at vente — databasen skal kobles på først.
   (Deployer den alligevel, fejler første build bare. Det er ufarligt.)

### 3. Kobl databasen på

1. Projektet → **Storage → Create Database → Neon** (Serverless Postgres).
2. Region: **Frankfurt (eu-central-1)** — samme region som appen (`vercel.json`).
3. Forbind den til projektet for **Production, Preview og Development**.
   Vercel sætter selv `DATABASE_URL` og `DATABASE_URL_UNPOOLED`.

### 4. Sæt miljøvariablerne

Projektet → **Settings → Environment Variables**:

| Navn | Værdi |
|---|---|
| `AUTH_SECRET` | En lang tilfældig nøgle (mindst 32 tegn). Lav en med `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `OPSAETNINGSKODE` | *Kun* hvis du starter med en tom database og skal oprette den første bruger på nettet. Mindst 8 tegn. Fjern den bagefter. |

### 5. Deploy

**Deployments → Redeploy** (eller push en ændring). Under build kører `prisma db push`, som opretter
tabellerne i Neon. Ændringer i `prisma/schema.prisma` lægges ud på samme måde ved næste deploy —
en ændring der ville slette data, stopper buildet i stedet for at køre.

### 6. Flyt dine data fra den lokale database

Kør på din egen computer i projektmappen:

```bash
npm install
npx vercel login
npx vercel link            # vælg projektet
npx vercel env pull .env   # henter DATABASE_URL m.fl. ned i .env
npm run db:flyt -- "D:\Claude\10_Programmer\CRM-Pro-app\CRM-Pro-data\crm-pro.db" --fiktiv
```

**`--fiktiv` gør alle kundedata fiktive undervejs.** Firmanavne, adresser, CVR, kontonumre, subdomæner,
mail, telefon og kontaktpersoner erstattes med opdigtede (samme branche, land og licenser), og navne,
mails og telefonnumre i fritekst — logbog, sager, notater, salgsmuligheder og ordrer — skiftes ud.
Størrelsestal sløres. Filboksens filer springes over, fordi PDF'er og uploads kan indeholde rigtige
data. Mail og web bruger domænet `.example`, og telefonnumre har formen `+45 00 00 xx xx`, så intet
kan ramme en rigtig virksomhed eller person. Udelad `--fiktiv` for at flytte de rigtige data.

Scriptet læser den lokale `crm-pro.db` (den ændres ikke) og skriver alt over i Neon: brugere, kunder,
kontakter, licenser, tilkøb, sager, klippekort, logbog, notater, katalog, tilbud, ordrer og filboksens
filer (fra mappen `filer` ved siden af databasen — eller angiv `--filer "<mappe>"`). Til sidst
klargøres kataloget: Idus med betingelser, prishistorik, SUB-numre og superadministrator.

Er der allerede kunder i Neon, stopper scriptet. `--overskriv` tømmer Neon først.

Log derefter ind på Vercel-adressen med dine sædvanlige initialer og PIN.

> **Starter du forfra i stedet:** sæt `OPSAETNINGSKODE`, åbn adressen og opret den første bruger
> (skriv koden i feltet). 43 fiktive demokunder med kontaktpersoner og licenser lægges ind med
> `npm run db:seed` (fra `prisma/demo-kunder.json`).

---

## Sikkerhed

- **Alt kræver login.** `middleware.ts` afviser alle sider, handlinger og `/api`-kald uden en gyldig,
  signeret login-cookie. Cookien er `httpOnly`, `secure` og gælder 12 timer.
- **5 forkerte PIN-koder i træk spærrer brugeren i 15 minutter.**
- PIN gemmes som scrypt-hash med eget salt.
- Hele **Indstillinger** kræver rollen superadministrator.
- Overvej desuden **Vercel → Settings → Deployment Protection** (fx Vercel Authentication på
  preview-adresser), og brug et privat GitHub-repository.
- Neon tager løbende sikkerhedskopier (point-in-time restore). En kopi i hånden: **Indstillinger →
  Eksport** henter hele databasen som JSON.

## Grænser på Vercel

- Filer i filboksen gemmes i databasen og må højst være **4 MB** pr. fil (Vercel tillader 4,5 MB pr. request).
- Neons gratis niveau har 0,5 GB lagerplads — rigeligt til kunder, logbog og PDF'er.

## Lokal udvikling

```bash
npm install
npx vercel env pull .env     # eller udfyld .env efter .env.example
npm run db:push              # opret/opdater tabeller
npm run dev
```

Til lokal udvikling kan du med fordel lave en **branch** af databasen i Neon, så du ikke arbejder i
produktionsdata.

## Scripts

| Kommando | Hvad den gør |
|---|---|
| `npm run dev` | Udviklingsserver |
| `npm run build` | Bygger appen |
| `npm run db:push` | Lægger skemaet ud i databasen |
| `npm run db:flyt -- "<crm-pro.db>"` | Flytter data fra den gamle lokale database til Postgres |
| `npm run db:klargoer` | Klargør katalog, SUB-numre og superadministrator (kan køres flere gange) |
| `npm run db:flyt -- "<crm-pro.db>" --fiktiv` | Samme, men med alle kundedata gjort fiktive |
| `npm run db:seed` | Lægger 43 fiktive demokunder ind i en tom database |
