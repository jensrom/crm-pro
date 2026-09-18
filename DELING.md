# CRM-Pro på en fælles database

Sådan flytter du databasen til en fælles placering, og sådan kobler du en
kollega på den. Læs "Reglerne" til sidst — de er ikke pynt.

---

## Før du går i gang: tag en kopi

Luk CRM-Pro helt. Kør så:

```powershell
$stempel = Get-Date -Format "yyyy-MM-dd-HHmm"
New-Item -ItemType Directory -Force -Path "D:\CRM-Pro-backup" | Out-Null
Copy-Item "D:\CRM-Pro\CRM-Pro-data\crm-pro.db" "D:\CRM-Pro-backup\crm-pro-$stempel.db"
Get-ChildItem "D:\CRM-Pro-backup"
```

Den kopi er hele dit CRM — kunder, produkter, sager, brugere, logo. Ligger den,
kan intet i resten af guiden gå galt uopretteligt.

---

## Del 1 — vælg den fælles placering

Tre krav, i prioriteret rækkefølge:

1. **Ikke en synkroniseret mappe.** OneDrive, SharePoint, Dropbox og Google Drive
   kopierer filen mens der skrives i den. Det ødelægger en SQLite-fil — ikke
   måske, men før eller siden. Programmet advarer dig hvis det ser "onedrive"
   eller "sharepoint" i stien.
2. **Brug UNC-stien, ikke et drevbogstav.** Dit `Z:` er ikke nødvendigvis hans
   `Z:`. Skriv `\\dkfil01\faelles\CRM-Pro\crm-pro.db`, ikke `Z:\CRM-Pro\crm-pro.db`.
   Så peger begge maskiner på det samme uanset hvordan de har mappet drev.
3. **I skal begge have skriveadgang** til mappen. Læseadgang er ikke nok — SQLite
   skriver journalfiler ved siden af databasen.

Opret mappen på drevet først, fx `\\dkfil01\faelles\CRM-Pro\`.

---

## Del 2 — flyt databasen derover

1. Start CRM-Pro, log ind som **JPR**.
2. Gå til **Indstillinger → Database**. Noter hvad der står under "Indhold"
   (antal kunder og sager) — det tal skal du genkende bagefter.
3. I feltet **Sti til databasefilen** skriver du den fulde sti inklusive filnavn:

   ```
   \\dkfil01\faelles\CRM-Pro\crm-pro.db
   ```

   Her skriver du stien helt normalt med backslashes. Ingen escaping.
4. Lad fluebenet **"Kopiér den nuværende database til den nye placering"** stå til.
   Det er det der flytter dine data med. Uden det starter du på en tom base.
5. Tryk **Gem placering**. Der kommer besked om at den træder i kraft ved genstart.
6. **Luk programmet helt** og start det igen.
7. Gå tilbage til **Indstillinger → Database** og tjek tre ting:
   - "Fil" viser den nye sti
   - Status siger **Fundet**
   - "Indhold" viser det samme antal kunder og sager som i punkt 2

Viser den **Ikke fundet**, eller vil programmet slet ikke starte, så stop og sig
til. Så er det stien der driller, og det er en rettelse i koden — ikke noget du
skal fifle med. Dine data ligger stadig i backup'en og i den gamle fil.

8. Når det virker, sætter du den gamle lokale fil ud af spillet så ingen kommer
   til at arbejde i den ved en fejl:

```powershell
Rename-Item "D:\CRM-Pro\CRM-Pro-data\crm-pro.db" "crm-pro.db.gammel"
```

---

## Del 3 — opret kollegaens bruger

Det her skal gøres **før** han starter programmet første gang, og det skal gøres
i den fælles database — altså fra din maskine, efter Del 2 er på plads.

1. **Indstillinger → Brugere**
2. Under "Ny bruger" udfylder du:
   - **Initialer** — det han logger ind med, fx `MHN`
   - **PIN** — 4–8 cifre. Giv ham den mundtligt, ikke på mail.
   - **Navn**, og evt. mail/telefon/stilling
   - **Rolle** — `bruger` eller `admin`
3. Tryk **Opret bruger**.

Om rollen: kun administratorer kan åbne **Indstillinger**. Det er der produkter,
brugere, whitelabel og databaseplaceringen ligger. Vil du ikke have at han kan
flytte databasen eller slette produkter, giver du ham `bruger`. Han kan stadig
alt det daglige — kunder, pipeline, sager, klippekort, notater.

---

## Del 4 — overlever programmet til kollegaen

### 4.1 Kopiér exe-filen over

Han skal kun bruge **én fil**:

```
D:\CRM-Pro\CRM-Pro-portable-1.0.0.exe
```

Læg den fx i `C:\CRM-Pro\` på hans maskine. Ikke på skrivebordet, ikke i
Overførsler — programmet lægger sin datamappe ved siden af sig selv, og den skal
have et fast sted at bo.

### 4.2 Peg den på den fælles database FØR første start

Det her trin er vigtigt, og det er nemt at springe over. Starter han programmet
uden det, laver den en frisk tom database ved siden af exe-filen, møder ham med
opsætningsskærmen, og han opretter en bruger i den forkerte database.

På hans maskine, kør i PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "C:\CRM-Pro\CRM-Pro-data" | Out-Null
@'
{
  "databasePath": "//dkfil01/faelles/CRM-Pro/crm-pro.db"
}
'@ | Set-Content -Encoding UTF8 "C:\CRM-Pro\CRM-Pro-data\crm-pro.config.json"
Get-Content "C:\CRM-Pro\CRM-Pro-data\crm-pro.config.json"
```

Bemærk **skråstregerne den anden vej**. Inde i en JSON-fil er `\` et
undtagelsestegn, så en normal Windows-sti skal enten dobbeltskrives
(`\\\\dkfil01\\faelles\\...`) eller skrives med `/` som herover. Det sidste er
sværere at tage fejl af. Programmet forstår begge dele.

### 4.3 Første start

1. Han dobbeltklikker `CRM-Pro-portable-1.0.0.exe`.
2. Windows SmartScreen brokker sig, fordi filen ikke er signeret:
   **Mere info → Kør alligevel**. Kun første gang.
3. Første start tager 10–20 sekunder — den pakker sig selv ud.
4. Der kommer en loginskærm. Han logger ind med sine initialer og sin PIN.
5. Han skal se **de samme kunder som dig**. Gør han ikke det, kører han på en
   tom lokal base, og så er 4.2 gået galt.

---

## Reglerne, når I er to om filen

Det her er ikke formaliteter. SQLite er én fil, og fillåse over SMB er ikke
pålidelige.

**Én ad gangen.** Åbn ikke programmet begge to på samme tid. Det går fint i
lange perioder, og så en dag gemmer I samtidig og filen er i stykker. Aftal
hvordan I signalerer det — en besked er nok.

**Aldrig i en synkroniseret mappe.** Uanset hvor fristende det er at bruge
SharePoint fordi I begge har den.

**Tag kopier.** Det gør programmet nu selv: **Indstillinger → Database →
Tag backup nu**. Kopierne lander i en `backup`-mappe ved siden af databasen —
altså ude på fællesdrevet, hvor I begge kan se dem — og listen viser hvornår
hver enkelt er taget og af hvem. Skal noget hentes tilbage, vælger du en kopi
i **Gendan en tidligere udgave**; den nyeste er valgt på forhånd, og der tages
automatisk en kopi af det nuværende først, så selve gendannelsen også kan
fortrydes.

Tag en før noget større. Programmet skal ikke lukkes for at tage en backup —
men det skal være lukket hos jer begge for at *gendanne*, for ellers holder
Windows fat i filen.

**Opdater exe-filen samtidig.** Kommer der en ny udgave med ændringer i
databasens struktur, skal I begge skifte exe på samme dag. En gammel exe på en
nyere database vil mangle felter og kan fejle.

---

## Hvordan ser man hinandens indtastninger

Der er ingen forbindelse mellem de to programmer — de deler kun filen. Derfor
skubbes Michaels indtastning ikke over på din skærm af sig selv.

Til gengæld henter programmet nu nye data hvert 20. sekund, og oppe i højre
hjørne står der **Opdateret 14:32**, så du altid kan se hvor gammelt det du
kigger på er. Klikker du på den, henter den med det samme. Den holder pause
mens du skriver i et felt, og mens vinduet er skjult.

Ved hver gem-knap står desuden **"Sidst gemt af Michael Hansen · i dag 14:32"**,
så du kan se om en kollega har rørt noget siden du åbnede siden.

---

## Den sikre variant, hvis I bliver flere end to

Den principielt rigtige løsning på en delt SQLite-base er at der kun er én
maskine der rører filen: den ene kører programmet, de andre åbner adressen i
deres browser og ser præcis det samme.

Appen **er** allerede en webserver — det er sådan den fungerer indeni. Men den
lytter i dag kun på maskinen selv, på en tilfældig port. For at kunne nås
udefra skal den lytte bredt på en fast port, og der skal åbnes for den i
Windows Firewall.

Det er en lille ændring i `electron/main.js`. Sig til hvis I når dertil, eller
hvis to bliver til tre — så bygger jeg den udgave.
