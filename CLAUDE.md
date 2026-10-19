# Leda i AI-takt: leda.mickla.se

Arbetsbeskrivning för den som utvecklar kursen vidare, människa eller Claude.

## Sammanhang

- Kurs för ledningsgrupper och styrelser i kunskapsföretag: grunderna om AI (variation, kostnad per körning, AI eller automation, granskning, agenter, takt) och praktiska metoder för fail fast, så att ledningen kan leda ett bolag i snabb teknikomställning. Vi utgår från att deltagarna kan leda ett bolag.
- Bygger på Dan Engströms förslag till AI-utbildning för en ledningsgrupp (2026-10-06): fyra block (Förstå, Bedöma, Generera, Leda), samma varv i varje (Lära, Pröva, Redovisa, Besluta), beslutsanalogin hatt, frisyr eller tatuering, ambidexteritet (March 1991; O'Reilly och Tushman 2004) och Prosci (2018) om vem som säger varför och hur.
- Upphov: Dan Engström, Engströms Mickla AB. Claude föreslår, Dan beslutar. Körs som test på mickla.se.
- Format (v1.1): förberedelse, fyra moduler på två timmar (en per block) och en uppföljning på en timme efter cirka tre månader. Varje modul slutar med beslut och sparad spelbok; två moduler kan köras i rad. Kursen är skarp: ledningen arbetar med sina verkliga frågor och bolagets eget material, i ett AI-verktyg som bolaget har godkänt för intern information. Kursledaren håller grunderna på storskärm; allt som handlar om att pröva görs av någon i ledningen.

## Fasta principer

- Inga tankstreck (varken — eller –) i texter.
- **Ingen data lämnar webbläsaren.** Ingen server, ingen statistik, inga kakor, inga externa typsnitt eller CDN. CSP i `publik/index.html` tillåter bara egna filer.
- **Ingen AI anropas från sajten.** Övningarna ger färdiga prompter att kopiera till organisationens eget, godkända AI-verktyg, och använder bara information som verktyget är godkänt för.
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

## Grunderna före gissningarna (v0.4)

- Varje block har `grund` i `kurs.js`: tre till sex bilder på cirka fem minuter som kursledaren visar först. Presentationsläget visar grunderna och gissningskorten i en följd (`presLista` i `app.js`); grundbilderna har inget svar att visa.
- Gissningskorten handlar om konsekvenser för den egna organisationen, inte om fakta som grunderna redan tagit upp.
- Förstå: hur en språkmodell fungerar (sannolikheter, tre källor till svaret: träning, samtal, verktyg), flyt är inte sanning, från fråga till agent, kostnad. Bedöma: envägs- och tvåvägsdörrar (Bezos 2015), hatt, frisyr, tatuering, klass och mandat, utforska och driva (March 1991). Generera: experiment och projekt, experimentets delar, bygg, mät, lär (Ries 2011), var idéerna finns. Leda: två sorters problem (Snowden och Boone 2007), traditionell problemlösning, fail fast, psykologisk trygghet (Edmondson 1999), spårbundenhet med innovatörens dilemma som ett fall av den (Sydow, Schreyögg och Koch 2009; Christensen 1997), och När alla kan bygga själva, där Conways lag nämns som namnet på fenomenet (Conway 1968; MacCormack, Rusnak och Baldwin 2012; Skelton och Pais 2019).
- Leda har gissningskort om Polaroid (Tripsas och Gavetti 2000), om den billigare varianten (Christensen 1997; Christensen, Wang och van Bever 2013) och om när alla bygger själva (Henderson och Clark 1990). Övningen Våra spår (`svar.leda.spar`) kan bli ett experimentkort. Övningen Det vi bygger själva (`svar.leda.bygga`) vänder Conways lag: det gemensamma bestäms först, och raderna kan läggas in i mandatet. Båda syns i spelboken och slås ihop vid sammanslagning.

## Arbeta parallellt (v0.3)

- Deltagare på egna datorer öppnar kursledarens låsta länk, arbetar och sparar sitt bidrag under Spelbok (`Bidrag_<namn>_<datum>.json`, samma format som spelboken med `meta.av`).
- Kursledaren slår ihop flera bidrag på en gång (`slaIhop` i `modell.js`). Inget skrivs över: idéer, experiment, beslut, egna kort och mandatrader läggs till om de inte redan finns (samma id eller samma text); texter läggs efter varandra med namn (`slaIhopText`); klassningar som saknas fylls i; olika klassningar rapporteras som oenighet och kan läggas under "Var var vi oense?". Ett experiment som någon har kommit längre med tar över status och resultat. Bidrag från en annan organisation avvisas. Samma bidrag två gånger ger inget nytt.

## Kursfilen

- JSON med `format: "mickla-leda-kursfil"`. Innehåller en kort `beskrivning` av organisationen (sätts in i prompterna i stället för `{beskrivning}`), `caseforslag`, organisationens sammanhang (strategi), spelregler (AI-policy och instruktion i korta rader), beslutsnivåer (idé, hatt, frisyr, tatuering med vem och mandat), beslutskort, uppgiftskort och startvärden för kostnadsövningen.
- Mallen i `publik/exempel/` har fält som börjar med `_` som förklarar resten. De läses inte av sajten. Mallen kan laddas ner från startsidan och från Så går det till.
- Kursfilsverktyget (`#kursfil`, länkat från startsidan och Så går det till, inte i menyn) är den enda vägen till en ny kursfil; mallen laddas inte ner separat. Börja från exemplet (påhittat bolag), en befintlig fil eller kursens nuvarande; kopiera prompten (med mallen som strukturexempel) till ett godkänt AI-verktyg tillsammans med organisationens dokument; klistra in svaret (`tolkaAiSvar` tar bort kodstaket, ger kort giltiga id och läser `_saknas`); granska i formuläret; kvalitetskontrollen (`kursfilVarningar`) visar vad som saknas och kan byta tankstreck; ladda ner (`kursfilTillJson`) eller pröva i kursen. Utkastet hålls i flikens sessionStorage.
- Byte till en kursfil för en annan organisation startar kursen om från början, så att arbete aldrig blandas mellan organisationer.
- Verkliga kursfiler ligger hos Dan, aldrig i repot.
- Förberedelsen (v1.1): utskicket görs under Så går det till (`kurs.utskick`, `utskickText`). Deltagarna mejlar fritt till kursledaren, med svar på tre frågor och bifogade dokument; ingen förberedelsesida med fasta fält. Kursledaren kör mejlen och dokumenten genom ett godkänt AI-verktyg (Dan använder ChatGPT, med en kontotyp utan träning på indata) med kursfilsverktygets prompt. Svaret ger kursfilen plus `fran_deltagarna` (namn, fråga, beslut, uppgift, uppgift_titel). Frågorna blir `caseforslag` och besluten beslutskort i kursfilen, utan namn. `startspelbok` gör en spelbok med deltagarnas namn och deras uppgifter i idéflödet med "Föreslagen av". Bara namn sparas om personerna. Namnen är kursfil (in) och spelbok (ut); "spelfil" används inte.

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

- Panelgranskning 2026-10-16 (AI/ML-utvecklare, förändringsledare, cybersäkerhet, pedagogik, problembaserat lärande, ledamot i en kunds ledningsgrupp, ledamot i annan ledningsgrupp) gav v0.2: ledningens case, lärandemål med självskattning, förslag först på begäran, nya kort om säkerhet (promptinjektion, skugg-AI), utvärdering mot nuläge och styrelsens frågor med AI-förordningens krav på AI-kunnighet, separat kostnad per agentsteg, startmandat, låst länk, Intern-märkning, Rensa allt, organisationsbeskrivning i kursfilen och mått i Takten.
- v1.1 (2026-10-19, Dans beslut): fyra moduler på två timmar i stället för förmiddag och pass; första testet är modul 1, som början på en serie. Förberedelse med utskick, sju mejl och dokument genom ChatGPT, och kursfil plus startspelbok ur samma AI-svar. Kursen är skarp: övningarna använder bolagets verkliga material i godkända verktyg. Uppropets fråga 3 gäller bolagets arbete, inte deltagarens eget.
- v1.0 (2026-10-17, efter Dans genomgång): case-frågorna i Förstå och Leda är numrerade steg; Samma fråga tre gånger betonar en ny chatt varje gång; Bygg ett litet verktyg frågar vilka antaganden AI gjorde själv. Ny sida Löpande arbete (`#arbete`, i menyn) för ledningens möten efter kursen: läs in spelboken, idéer, redovisning och nya experiment, beslutsguide och logg, takt, spara. Samma kort som i kursen, utan övningarnas tider och instruktioner (`iArbete` i `app.js`). Kort att skriva ut (`kortHtml`): ifyllda experimentkort för planerade och pågående experiment plus tomma experiment-, idé- och beslutskort, fyra per A4. Spelboken och korten öppnas i ny flik med formatering; deras formatering ligger i `STIL_SPELBOK` och `STIL_KORT`, och kontrollsummorna står i CSP:n i `index.html`. Ändras formateringen måste kontrollsummorna uppdateras; ett test säger vilken som saknas.
- v0.9 (2026-10-16, Dans beslut): kontaktformulär i stället för e-post och telefon. Formuläret skickar inget själv; det sätter ihop ett mejl till Dans adress på mickla.se i besökarens eget e-postprogram (`kontaktMejl` i `modell.js`). Adressen sätts ihop i koden och står inte i klartext på sidan. Ingen tredjepartstjänst, eftersom CSP och principerna inte tillåter det. Om kursen eller kunder nämns inte vid namn, varken på sajten eller i repot.
- v0.8 (2026-10-16, Dans önskemål): sidan Om kursen (`#om`, i menyn) med upplägg, bakgrund, att det är en första utgåva, om informationen, kontaktformulär och litteraturlistan. Kontaktuppgifterna och litteraturen ligger i `kurs.om`. Kursen nämner inga kunder vid namn. Ett test kontrollerar att varje källa som används i kursen finns i litteraturlistan.
- v0.7 (2026-10-16, Dans beslut): kursen riktar sig bara till ledningsgrupper och styrelser, smalt scope är mer träffsäkert; inget talarmanus, grundbildernas punkter är självinstruerande; kursutvärdering i slutet av Leda (`svar.utvardering`), som slås ihop utan namn, syns i spelboken och kan kopieras som text till kursledaren; frågan om hur många timmar ett test får ta i startmandatet, sex timmar om den inte besvaras (`svar.generera.mandatTimmar`, `kurs.startmandatTimmar`); uppföljningspass på en timme efter cirka tre månader; Prosci-uppgiften uppdaterad till 12:e upplagan 2023 (58 procent vill höra om personliga konsekvenser från närmaste chef).
- v0.6 (2026-10-16): mallens nedladdningslänk borttagen; grundbilden om Conways lag heter När alla kan bygga själva; övningstiderna stämmer med kursplanen; Generera-grunderna visas i pass 1 före experimentkorten; två Bedöma-kort skrivna om till konsekvensfrågor; kortet Ledningens fyra verktyg borttaget så att pass 3 ryms på två timmar. Ett test kontrollerar passens längd.
- v0.5 (2026-10-16, Dans önskemål): innovatörens dilemma ingår i spårbundenheten; Conways lag som grundbild, gissningskort och övning i Leda.
- v0.4 (2026-10-16, Dans önskemål): fem minuters grunder i presentationsläget före gissningarna i varje block, och spårbundenhet och innovatörens dilemma i Leda.
- v0.3 (2026-10-16, Dans önskemål): sammanslagning av deltagarnas bidrag så att alla kan arbeta parallellt, och kursfilsverktyget för nya kunder.
- Avfärdat i panelen: egen server för realtid (bryter principerna), poäng och prov (fel ton för en ledning), engelsk version (senare).
- Organisationers eget material ligger i en lokal kursfil, aldrig i repot (2026-10-16).
- Ordningen Förstå, Bedöma, Generera, Leda (Dans beslut 2026-10-16).
- Subdomänen heter tills vidare leda (leda.mickla.se). Byts i `publik/CNAME`, DNS och Pages-inställningarna.

## Öppna frågor

- Om kursen ska finnas på engelska.
- Om lösenfrasen ska vara obligatorisk när kursen används hos kund.
- Om spelboken ska kunna exporteras till Word eller Excel för en organisations verksamhetsplan.

## Test och publicering

Kör `node scripts/kontrollera.mjs` och `npm test`. Kör hela flödet i Playwright (Chromium) i dator-, storskärms- och telefonstorlek: läs in kursfil, välj case, alla övningar i alla fyra block, självskattning, presentationsläget, spara spelboken med lösenfras och utan, två deltagare som sparar bidrag och sammanslagningen, kursfilsverktyget med ett AI-svar, öppna spelboksfilen, öppna den låsta länken med fel och rätt fras i en ny webbläsare, läs in spelboksfilen, Rensa allt, och kontrollera att inga anrop görs utanför den egna domänen. Dan laddar upp via GitHubs webbgränssnitt; `.github` skapas med Add file > Create new file. Publicera aldrig utan att Dan har sagt "publicera".
