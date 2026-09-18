# Byg CRM-Pro som portabel exe

Trin for trin. Alt foregår i PowerShell i projektmappen.

---

## 0. Før du går i gang

**Luk programmet hvis det kører.** Står der en `npm run app` eller `npm run dev`
i et andet PowerShell-vindue, så tryk `Ctrl + C` der først. To ting kan ikke
skrive i den samme database.

**Tag en kopi af databasen.** Den indeholder dine kunder, din bruger og alt
andet:

```powershell
cd "D:\Claude Test\Idus Online Kunder\CRM-Pro"
New-Item -ItemType Directory -Force -Path D:\CRM-Pro-backup | Out-Null
Copy-Item prisma\crm-pro.db "D:\CRM-Pro-backup\crm-pro-$(Get-Date -Format yyyy-MM-dd-HHmm).db"
```

Kopien får dato og klokkeslæt i navnet, så du kan køre kommandoen igen senere
uden at overskrive den forrige.

Brug ikke `$env:USERPROFILE\Desktop` — er skrivebordet omdirigeret til OneDrive,
findes den sti ikke. Skal kopien endelig ligge på skrivebordet, så lad Windows
selv finde det:

```powershell
Copy-Item prisma\crm-pro.db "$([Environment]::GetFolderPath('Desktop'))\crm-pro-backup.db"
```

Ligger kopien der, kan intet i det følgende gå galt for dine data.

---

## 1. Hent Electron

```powershell
npm install
```

Den henter to nye pakker: `electron` (~150 MB) og `electron-builder`.
Første gang tager det to til fem minutter afhængigt af linjen.

Du er færdig når der står noget i retning af `added 2 packages`.
Advarsler om `deprecated` er normale og kan ignoreres.

**Tjek at det virkede:**

```powershell
Test-Path node_modules\electron
Test-Path node_modules\electron-builder
```

Begge skal svare `True`.

---

## 2. Byg exe-filen

```powershell
npm run dist
```

Det tager typisk tre til otte minutter. Undervejs kører fire trin, og hvert
skriver sin egen overskrift:

| Overskrift | Hvad der sker | Ca. tid |
|---|---|---|
| `=== Skema som SQL ===` | Databasestrukturen skrives til `prisma\init.sql` | få sekunder |
| `=== Prisma-klient ===` | Klient og motor genereres | 10-30 sek. |
| `=== Next-build (standalone) ===` | Hele appen oversættes | 1-3 min. |
| `=== Electron-pakning ===` | Alt samles til én exe | 1-4 min. |

Til sidst står der:

```
=== Færdig ===
Filen ligger i:  D:\Claude Test\Idus Online Kunder\CRM-Pro\dist
```

**Tjek at filen findes:**

```powershell
Get-ChildItem dist\*.exe | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
```

Du skal se `CRM-Pro-portable-1.0.0.exe` på omkring 90-120 MB.

---

## 3. Læg filen hvor den skal bruges

Opret en mappe til programmet — for eksempel på en USB-nøgle eller i
`D:\CRM-Pro`:

```powershell
New-Item -ItemType Directory -Force -Path D:\CRM-Pro | Out-Null
Copy-Item dist\CRM-Pro-portable-1.0.0.exe D:\CRM-Pro\
```

---

## 4. Tag dine nuværende data med

**Gør det her INDEN du starter exe-filen første gang.** Ellers laver den en tom
database, og så skal du rydde op bagefter.

```powershell
New-Item -ItemType Directory -Force -Path D:\CRM-Pro\CRM-Pro-data | Out-Null
Copy-Item "D:\Claude Test\Idus Online Kunder\CRM-Pro\prisma\crm-pro.db" `
          D:\CRM-Pro\CRM-Pro-data\crm-pro.db
```

Mappen skal hedde præcis `CRM-Pro-data` og ligge ved siden af exe-filen.
Filen skal hedde præcis `crm-pro.db`.

Springer du trin 4 over, starter programmet med en tom base, opretter de tre
pakker og de 43 kunder fra grunden, og beder dig lave den første bruger.

---

## 5. Start programmet

Dobbeltklik `D:\CRM-Pro\CRM-Pro-portable-1.0.0.exe`.

**Windows SmartScreen kommer frem første gang.** Filen er ikke kodesigneret.
Klik "Flere oplysninger" og derefter "Kør alligevel". Det spørger kun én gang
pr. maskine.

Første start tager 5-15 sekunder mens serveren varmer op. Derefter åbner
vinduet på login-skærmen.

Kopierede du databasen ind i trin 4, logger du ind med dine egne initialer og
din PIN. Gjorde du ikke, bliver du bedt om at oprette den første bruger.

---

## 6. Tjek at alt kom med

Når du er logget ind:

- **Kunder** — listen skal vise dine kunder
- **Indstillinger → Database** — stien skal pege ned i `CRM-Pro-data`
- **Hjælp → Om CRM-Pro** — viser datamappe og port
- **Filer → Åbn datamappen** — Stifinder åbner det rigtige sted

---

## Sådan flytter du programmet

Kopiér **både exe-filen og mappen `CRM-Pro-data`** til det nye sted. De to hører
sammen. Tager du kun exe-filen med, starter den med en tom database.

## Sikkerhedskopi

Luk programmet og kopiér mappen `CRM-Pro-data`. Det er hele sikkerhedskopien —
kunder, sager, notater, brugere, logo og indstillinger.

---

## Når noget går galt

### `npm run dist` stopper i "Skema som SQL"

Prisma kan ikke hente sin motor. Tjek netværket og prøv igen. Er du bag en
proxy, skal `HTTPS_PROXY` være sat i PowerShell-sessionen.

### `npm run dist` stopper i "Next-build"

En kode- eller typefejl. Kør `npm run build` alene — den viser samme fejl med
fil og linjenummer.

### `npm run dist` stopper i "Electron-pakning"

Som regel en antivirus der holder på filer i `dist\`. Luk Stifinder-vinduer der
peger på mappen, slet `dist` og prøv igen:

```powershell
Remove-Item -Recurse -Force dist
npm run dist
```

### Programmet åbner og lukker med det samme

Der kommer en fejlbesked med både datamappe og programmappe i. Læs den — den
peger på hvad der mangler.

### "Serveren svarede ikke inden for 60 sekunder"

Næsten altid en antivirus der scanner den udpakkede mappe ved første start.
Prøv igen. Sker det hver gang, så udelad exe-filen fra realtidsscanning.

### Vinduet er hvidt

Tryk `Ctrl + R` for at genindlæse. Bliver det ved, så åbn
**Vis → Udviklerværktøjer** og se hvad konsollen siger.

---

## Byg en ny version senere

Når koden er ændret:

```powershell
cd "D:\Claude Test\Idus Online Kunder\CRM-Pro"
npm run dist
Copy-Item dist\CRM-Pro-portable-1.0.0.exe D:\CRM-Pro\ -Force
```

`CRM-Pro-data` skal du ikke røre — den nye exe læser den samme database og
tilføjer selv tabeller der måtte være kommet til.

Vil du have et versionsnummer på filen, så ret `"version"` i `package.json`
inden du bygger. Filnavnet følger det tal.
