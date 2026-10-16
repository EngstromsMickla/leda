# Leda i AI-takt: leda.mickla.se

Arbetsbeskrivning för den som utvecklar kursen vidare, människa eller Claude.

## Sammanhang

- Kurs för ledningsgrupper och styrelser i kunskapsföretag: grunderna om AI (variation, kostnad per körning, AI eller automation, granskning, agenter, takt) och praktiska metoder för fail fast, så att ledningen kan leda ett bolag i snabb teknikomställning. Vi utgår från att deltagarna kan leda ett bolag.
- Bygger på Dan Engströms förslag "AI-utbildning för Plan B" (2026-10-06): fyra block (Förstå, Bedöma, Generera, Leda), samma varv i varje (Lära, Pröva, Redovisa, Besluta), beslutsanalogin hatt, frisyr eller tatuering, ambidexteritet (March 1991; O'Reilly och Tushman 2004) och Prosci (2018) om vem som säger varför och hur.
- Upphov: Dan Engström, Engströms Mickla AB. Claude föreslår, Dan beslutar. Körs som test på mickla.se; om Plan B vill ha kursen får de tillgång till det de behöver.
- Format: en förmiddag (cirka 3,5 timmar) och därefter ett eller två pass på cirka 2 timmar. Kursledaren håller kunskapspassen på storskärm; allt som handlar om att pröva görs av någon i ledningen.

## Fasta principer

- Inga tankstreck (varken — eller –) i texter.
- **Ingen data lämnar webbläsaren.** Ingen server, ingen statistik, inga kakor, inga externa typsnitt eller CDN. CSP i `publik/index.html` tillåter bara egna filer.
- **Ingen AI anropas från sajten.** Övningarna ger färdiga prompter att kopiera till organisationens eget, godkända AI-verktyg, och använder bara öppen, påhittad eller egen information.
- Tillståndet hålls i minnet och i flikens sessionStorage. Ingen localStorage (kontrollen stoppar det).
- All text läggs in med DOM-metoder och `textContent`, aldrig `innerHTML`. Spelboken byggs som en textsträng i `modell.js` där allt användarinnehåll går genom `esc()`.
- Filer och länkar läses försiktigt (`lasKursfil`, `lasTillstand` i `modell.js`): bara kända fält, giltiga id, kapad text, kända värden.
- **Publikt repo.** Bara den påhittade mallen `publik/exempel/Exempel_kursfil.json`. Verkliga kursfiler och sparade spelböcker får aldrig ligga i repot; kontrollen stoppar båda.
- Formspråk som Boost, Hävstångskartan och profil. Upphovsrad "© Engströms Mickla AB 2026". Versionsnummer i `innehall/kurs.js` och i sidfoten i `index.html` räknas upp vid varje publicering.

## Ledningens case och lärandemål (v0.2)

- Problembaserad tråd: på startsidan väljer ledningen en verklig fråga (förslag kan komma från kursfilens `caseforslag`). Varje block visar frågan överst och slutar i Redovisa med "Tillbaka till ert case" (`svar.<block>.fall`).
- Varje block har tre lärandemål (`mal` i `kurs.js`) som visas överst och skattas gemensamt i Redovisa (Ja, Delvis, Inte än). Startsidan har fältet "Det här vill vi kunna efter kursen". Allt hamnar i spelboken.
- I övningen AI, automation eller människa visas kursens förslag först när gruppen ber om det.
- Startmandat: Generera föreslår ett beslut om vad som får prövas mellan passen (`kurs.startmandat`).

## Arbeta parallellt (v0.3)

- Deltagare på egna datorer öppnar kursledarens låsta länk, arbetar och sparar sitt bidrag under Spelbok (`Bidrag_<namn>_<datum>.json`, samma format som spelboken med `meta.av`).
- Kursledaren slår ihop flera bidrag på en gång (`slaIhop` i `modell.js`). Inget skrivs över: idéer, experiment, beslut, egna kort och mandatrader läggs till om de inte redan finns (samma id eller samma text); texter läggs efter varandra med namn (`slaIhopText`); klassningar som saknas fylls i; olika klassningar rapporteras som oenighet och kan läggas under "Var var vi oense?". Ett experiment som någon har kommit längre med tar över status och resultat. Bidrag från en annan organisation avvisas. Samma bidrag två gånger ger inget nytt.

## Kursfilen

- JSON med `format: "mickla-leda-kursfil"`. Innehåller en kort `beskrivning` av organisationen (sätts in i prompterna i stället för `{beskrivning}`), `caseforslag`, organisationens sammanhang (strategi), spelregler (AI-policy och instruktion i korta rader), beslutsnivåer (idé, hatt, frisyr, tatuering med vem och mandat), beslutskort, uppgiftskort och startvärden för kostnadsövningen.
- Mallen i `publik/exempel/` har fält som börjar med `_` som förklarar resten. De läses inte av sajten. Mallen kan laddas ner från startsidan och från Så går det till.
- Kursfilsverktyget (`#kursfil`, länkat från startsidan och Så går det till, inte i menyn): börja från mallen, en befintlig fil eller kursens nuvarande; kopiera prompten (med mallen som strukturexempel) till ett godkänt AI-verktyg tillsammans med organisationens dokument; klistra in svaret (`tolkaAiSvar` tar bort kodstaket, ger kort giltiga id och läser `_saknas`); granska i formuläret; kvalitetskontrollen (`kursfilVarningar`) visar vad som saknas och kan byta tankstreck; ladda ner (`kursfilTillJson`) eller pröva i kursen. Utkastet hålls i flikens sessionStorage.
- Byte till en kursfil för en annan organisation startar kursen om från början, så att arbete aldrig blandas mellan organisationer.
- Plan Bs kursfil (`Plan_B_kursfil.json`) bygger på AI-policy v0.3, AI-instruktion v0.1, Strategi 2026+5, Kapitel 2026/27 Lyft! och förslaget till FoI-råd. Den ligger hos Dan, inte i repot.

## Spelboken och länken

- Spelboken är en fristående HTML-fil (egen CSP, inga skript utom ett datablock `<script type="application/json" id="leda-data">`). Den kan öppnas, skrivas ut och läsas in igen på startsidan.
- Överst finns en fortsätt-länk i ett av tre lägen som väljs i Spelbok: låst med lösenfras (standard, `#las=...`: PBKDF2 SHA-256 med 250 000 varv och AES-GCM 256 i webbläsarens egen kryptering; lösenfrasen hålls bara i minnet), utan lösenfras (`#data=...`) eller ingen länk. Tillståndet komprimeras (deflate-raw) och läggs i länkens #-del. #-delen skickas aldrig till servern. Varje del i spelboken har en egen länk till rätt övning (`till=leda/ov-mandat` osv.). Länken byggs bara om sajten körs över http(s), och utelämnas om den skulle bli längre än 60 000 tecken.
- När sajten öppnas med en sådan länk städas adressen till `#till`. En låst länk visar en sida för lösenfrasen; fel fras ger ett tydligt fel och ingenting skrivs över.
- Spelboken är märkt Intern. Knappen "Rensa allt i den här webbläsaren" (två klick) tömmer fliken på gemensamma datorer.

## Struktur

- `publik/`: det som publiceras. `index.html`, `style.css`, `app.js` (vyerna), `modell.js` (regler, filer, spelbok, länk), `innehall/kurs.js` (alla kurstexter), `exempel/Exempel_kursfil.json`, `img/mickla.png`, `CNAME`.
- Vyer: Start (`#start`), blocken (`#forsta`, `#bedoma`, `#generera`, `#leda`, med ankare `lara`, `prova`, `redovisa`, `besluta`, `ov-<övning>`), Spelbok (`#spelbok`), Så går det till (`#guide`).
- Presentationsläget: knappen Presentera på storskärm i varje block. Pil höger eller mellanslag visar svaret och går vidare, pil vänster backar, Esc stänger. Knappen Storskärm i menyn ger större text.
- `test/`: Node-tester (`npm test`). `scripts/kontrollera.mjs`: externa adresser, innerHTML, localStorage, tankstreck, CSP, kursfiler och spelböcker i repot.
- `.github/workflows/publicera.yml`: kontroller och tester före varje publicering.

## Beslut

- Panelgranskning 2026-10-16 (AI/ML-utvecklare, förändringsledare, cybersäkerhet, pedagogik, problembaserat lärande, ledamot i Plan Bs ledningsgrupp, ledamot i annan ledningsgrupp) gav v0.2: ledningens case, lärandemål med självskattning, förslag först på begäran, nya kort om säkerhet (promptinjektion, skugg-AI), utvärdering mot nuläge och styrelsens frågor med AI-förordningens krav på AI-kunnighet, separat kostnad per agentsteg, startmandat, låst länk, Intern-märkning, Rensa allt, organisationsbeskrivning i kursfilen och mått i Takten.
- v0.3 (2026-10-16, Dans önskemål): sammanslagning av deltagarnas bidrag så att alla kan arbeta parallellt, och kursfilsverktyget för nya kunder.
- Avfärdat i panelen: egen server för realtid (bryter principerna), poäng och prov (fel ton för en ledning), engelsk version (senare).
- Plan B-material ligger i en lokal kursfil, aldrig i repot (2026-10-16).
- Ordningen Förstå, Bedöma, Generera, Leda (Dans beslut 2026-10-16).
- Subdomänen heter tills vidare leda (leda.mickla.se). Byts i `publik/CNAME`, DNS och Pages-inställningarna.

## Öppna frågor

- Om kursen ska finnas på engelska.
- Om lösenfrasen ska vara obligatorisk när kursen används hos kund.
- Om spelboken ska kunna exporteras till Word eller Excel för Plan Bs verksamhetsplan.

## Test och publicering

Kör `node scripts/kontrollera.mjs` och `npm test`. Kör hela flödet i Playwright (Chromium) i dator-, storskärms- och telefonstorlek: läs in kursfil, välj case, alla övningar i alla fyra block, självskattning, presentationsläget, spara spelboken med lösenfras och utan, två deltagare som sparar bidrag och sammanslagningen, kursfilsverktyget med ett AI-svar, öppna spelboksfilen, öppna den låsta länken med fel och rätt fras i en ny webbläsare, läs in spelboksfilen, Rensa allt, och kontrollera att inga anrop görs utanför den egna domänen. Dan laddar upp via GitHubs webbgränssnitt; `.github` skapas med Add file > Create new file. Publicera aldrig utan att Dan har sagt "publicera".
