import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import kurs from "../publik/innehall/kurs.js";
import * as M from "../publik/modell.js";

const exempelText = fs.readFileSync(new URL("../publik/exempel/Exempel_kursfil.json", import.meta.url), "utf8");
const exempel = () => M.lasKursfil(exempelText);

test("kursen har fyra block i rätt ordning och alla övningar finns", () => {
  assert.deepEqual(kurs.block.map((b) => b.id), M.BLOCK);
  for (const b of kurs.block) {
    assert.ok(b.lara.length >= 3, b.id);
    for (const id of b.prova) assert.ok(kurs.ovningar[id], `${b.id}: ${id}`);
    for (const k of b.lara) assert.ok(k.rubrik && k.gissa && k.svar.length, `${b.id}/${k.id}`);
  }
  assert.deepEqual(kurs.klasser.map((k) => k.id), M.KLASSER);
  assert.deepEqual(kurs.ovningar.sortera.lagen.map((l) => l.id), M.LAGEN);
  assert.deepEqual(kurs.ovningar.karta.zoner.map((z) => z.id), M.ZONER);
  assert.deepEqual(kurs.ovningar.experiment.status.map(([v]) => v), M.STATUS);
});

test("exempelkursfilen är påhittad, komplett och läses försiktigt", () => {
  const k = exempel();
  assert.match(k.organisation, /påhittat/);
  assert.ok(k.beslutskort.length >= 6 && k.uppgiftskort.length >= 6);
  assert.ok(k.beslutskort.every((b) => M.KLASSER.includes(b.forslag)));
  assert.ok(k.uppgiftskort.every((u) => M.UPPGIFTSVAL.includes(u.svar)));
  assert.ok(k.beslutsnivaer.hatt.vem && k.spelregler.principer.length);
  assert.throws(() => M.lasKursfil({ format: "annat" }));
  const ond = M.lasKursfil({
    format: M.FORMAT_KURSFIL, organisation: "x".repeat(999),
    beslutskort: [{ id: "OK NEJ", text: "a" }, { id: "ok", text: "b", forslag: "bil" }, { id: "ok", text: "dubbel" }],
    kostnad: { anvandare: -5, perFraga: "abc" },
  });
  assert.equal(ond.organisation.length, 160);
  assert.deepEqual(ond.beslutskort.map((b) => b.id), ["ok"]);
  assert.equal(ond.beslutskort[0].forslag, "");
  assert.equal(ond.kostnad.anvandare, 1);
  assert.equal(ond.kostnad.perFraga, 0.2);
});

test("beslutsguiden föreslår klass", () => {
  const bas = { angra: "ja", info: "oppen", beroende: "nej", kostnad: "ja", karna: "nej" };
  assert.equal(M.guideForslag({}), null);
  assert.equal(M.guideForslag({ ...bas, karna: undefined }), null);
  assert.equal(M.guideForslag(bas).klass, "hatt");
  assert.equal(M.guideForslag({ ...bas, info: "intern" }).klass, "hatt");
  assert.equal(M.guideForslag({ ...bas, beroende: "ja" }).klass, "frisyr");
  assert.equal(M.guideForslag({ ...bas, angra: "nej" }).klass, "frisyr");
  assert.equal(M.guideForslag({ ...bas, kostnad: "nej" }).klass, "frisyr");
  assert.equal(M.guideForslag({ ...bas, info: "kund" }).klass, "tatuering");
  assert.equal(M.guideForslag({ ...bas, karna: "ja", angra: "nej" }).klass, "tatuering");
});

test("kostnadskalkylen räknar rätt", () => {
  const r = M.kostnadBerakna({ anvandare: 10, fragor: 10, perFraga: 1, dagar: 100, licens: 100, agentUppgifter: 10, agentSteg: 10, agentPerSteg: 2 });
  assert.equal(r.anvandning, 10000);
  assert.equal(r.licenser, 12000);
  assert.equal(r.agenter, 2400);
  assert.equal(r.totalt, 24400);
  assert.equal(r.fyrdubbel, 54400);
  assert.equal(M.kostnadsvarden({}).agentPerSteg, 1);
  assert.equal(M.kr(1234567.4), "1 234 567 kr");
});

function fylltTillstand() {
  const S = M.nyttTillstand(exempel());
  S.meta.deltagare = ["Anna, vd", "Bertil"];
  S.svar.fall = { fraga: "Hur behåller vi marginalen?", varfor: "Timmarna minskar", kunna: "Besluta om prismodell" };
  S.svar.forsta.fall = "Fakturering är en regel";
  S.svar.forsta.mal = { 0: "ja", 1: "delvis", 7: "nej", x: "ja" };
  S.svar.leda.takt.matt = "Antal tester per kvartal";
  S.svar.forsta.uppgifter = { faktura: "auto", pris: "ai", NOPE: "ai" };
  S.svar.forsta.kommentar = { pris: "Vi tror AI kan mer" };
  S.svar.forsta.kostnad = { anvandare: 12 };
  S.svar.bedoma.egnaKort = [{ id: "egen-1", text: "Eget beslut" }];
  S.svar.bedoma.placering.idag = { forum: "hatt", arkiv: "tatuering", "egen-1": "frisyr" };
  S.svar.bedoma.placering.billigt = { forum: "hatt", arkiv: "frisyr", "egen-1": "frisyr" };
  S.svar.bedoma.placering.last = { forum: "tatuering", arkiv: "tatuering" };
  S.svar.generera.ideer = [{ id: "ide-1", titel: "Anbudsstöd", uppgift: "Läsa underlag", av: "Bertil", ofta: "veckovis", samma: "nej", info: "oppen" }];
  S.svar.generera.experiment = [{ id: "exp-1", ide: "ide-1", titel: "Pröva anbudsstöd", ansvarig: "Bertil", hypotes: "Vi tror", test: "", nulage: "En dag per anbud", matt: "", misslyckat: "", timmar: 4, stopp: "2026-11-20", klass: "hatt", status: "pagar", resultat: "", lardom: "", beslut: "" }];
  S.svar.leda.budskap.varfor = "Därför att </script><script>alert(1)</script> & \"citat\"";
  S.svar.leda.mandat.fritt = ["Testa på påhittat"];
  S.svar.leda.karta = { "exp-1": "grind" };
  S.svar.leda.flytt = { "exp-1": "En ägare i linjen" };
  S.beslut = [{ id: "b-1", block: "leda", text: "Vi startar forumet", klass: "hatt", ansvarig: "Anna", datum: "2026-11-01" }];
  return S;
}

test("tillståndet läses försiktigt", () => {
  const S = M.lasTillstand(JSON.parse(JSON.stringify(M.sparbart(fylltTillstand()))));
  assert.deepEqual(S.svar.forsta.uppgifter, { faktura: "auto", pris: "ai" });
  assert.equal(S.svar.forsta.kostnad.anvandare, 12);
  assert.equal(S.svar.generera.experiment[0].timmar, 4);
  assert.equal(S.svar.leda.karta["exp-1"], "grind");
  assert.equal(S.svar.fall.fraga, "Hur behåller vi marginalen?");
  assert.deepEqual(S.svar.forsta.mal, { 0: "ja", 1: "delvis", 7: "nej" });
  assert.equal(S.svar.generera.experiment[0].nulage, "En dag per anbud");
  assert.equal(S.svar.leda.takt.matt, "Antal tester per kvartal");
  const fl = M.flyttade(S);
  assert.deepEqual(fl.map((f) => `${f.kort.id}:${f.lage}:${f.fran}>${f.till}`).sort(), ["arkiv:billigt:tatuering>frisyr", "forum:last:hatt>tatuering"]);
  const k = M.kartobjekt(S);
  assert.equal(k.length, 1, "idén med experimentkort visas bara som experiment");

  const ond = M.sparbart(fylltTillstand());
  ond.svar.leda.karta = { "exp-1": "himlen", okand: "explore" };
  ond.svar.generera.experiment[0].status = "klart";
  ond.svar.generera.experiment[0].stopp = "i morgon";
  ond.beslut.push({ id: "<x>", text: "nej" }, { id: "b-2", block: "x", text: "" });
  ond.meta.deltagare = Array(100).fill("a");
  const T = M.lasTillstand(ond);
  assert.deepEqual(T.svar.leda.karta, {});
  assert.equal(T.svar.generera.experiment[0].status, "planerat");
  assert.equal(T.svar.generera.experiment[0].stopp, "");
  assert.equal(T.beslut.length, 1);
  assert.equal(T.meta.deltagare.length, 30);
  assert.throws(() => M.lasTillstand({ format: "annat" }));
});

test("spelboken är fristående, escapar text och går att läsa in igen", () => {
  const S = fylltTillstand();
  const html = M.spelbokHtml(S, kurs, { origin: "https://exempel.test", lank: "abc123_-", logga: "" });
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(!html.includes("<script>alert"), "användartext får aldrig bli kod");
  assert.equal((html.match(/<script/g) || []).length, 1, "bara datablocket");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /#data=abc123_-&amp;till=spelbok/);
  assert.match(html, /#data=abc123_-&amp;till=leda\/ov-mandat/);
  assert.match(html, /Intern/);
  assert.match(html, /Hur behåller vi marginalen\?/);
  assert.match(html, /Självskattning mot lärandemålen/);
  const last = M.spelbokHtml(S, kurs, { origin: "https://exempel.test", lank: "xyz", lankTyp: "las" });
  assert.match(last, /#las=xyz&amp;till=spelbok/);
  assert.match(last, /låst med en lösenfras/);
  assert.ok(!/[–—]/.test(html), "inga tankstreck");
  const r = M.lasFil(html);
  assert.equal(r.typ, "spelbok");
  assert.equal(r.S.svar.leda.budskap.varfor, S.svar.leda.budskap.varfor);
  assert.equal(r.S.beslut[0].text, "Vi startar forumet");
  assert.equal(M.lasFil(exempelText).typ, "kursfil");
  assert.throws(() => M.lasFil("<html>inget</html>"));
  const utan = M.spelbokHtml(M.nyttTillstand(exempel()), kurs, {});
  assert.ok(!/href="[^#]/.test(utan.replace(/<a href="#[^"]*"/g, "")), "inga länkar ut utan origin");
});

test("fortsätt-länken packar och packar upp tillståndet", async () => {
  const S = fylltTillstand();
  const kod = await M.packa(S);
  assert.match(kod, /^[A-Za-z0-9_-]+$/);
  assert.ok(kod.length < 8000, `länken är ${kod.length} tecken`);
  const T = await M.packaUpp(kod);
  assert.deepEqual(T.svar, M.lasTillstand(M.sparbart(S)).svar);
  await assert.rejects(M.packaUpp("inte giltig!"));
  await assert.rejects(M.packaUpp("AAAAAAAAAAAAAAAA"));
});

test("låst länk: rätt lösenfras öppnar, fel stoppar", async () => {
  const S = fylltTillstand();
  await assert.rejects(M.packaLast(S, "kort"));
  const kod = await M.packaLast(S, "rätt häst batteri");
  assert.match(kod, /^[A-Za-z0-9_-]+$/);
  const T = await M.packaUppLast(kod, "rätt häst batteri");
  assert.equal(T.svar.fall.fraga, S.svar.fall.fraga);
  await assert.rejects(M.packaUppLast(kod, "fel fras här"), /fras/);
  const andra = await M.packaLast(S, "rätt häst batteri");
  assert.notEqual(kod, andra, "nytt salt och iv varje gång");
});

test("versionen är densamma i innehållet och sidfoten", () => {
  const html = fs.readFileSync(new URL("../publik/index.html", import.meta.url), "utf8");
  assert.ok(html.includes(`Leda i AI-takt · ${kurs.version}`));
  for (const b of kurs.block) assert.equal(b.mal.length, 3, b.id);
});

test("sammanslagning lägger till utan att skriva över och visar oenighet", () => {
  const bas = fylltTillstand();
  const kursledare = M.lasTillstand(M.sparbart(bas));
  const anna = M.lasTillstand(M.sparbart(bas));
  anna.meta.av = "Anna";
  anna.svar.generera.ideer.push({ id: "ide-anna", titel: "Annas idé", uppgift: "", av: "Anna", ofta: "", samma: "", info: "" });
  anna.svar.generera.experiment[0].resultat = "Halva tiden";
  anna.svar.generera.experiment[0].status = "lyckat";
  anna.svar.bedoma.placering.idag.forum = "frisyr";
  anna.svar.bedoma.placering.idag.tid = "hatt";
  anna.svar.leda.budskap.experiment = "Därför att vi måste lära";
  anna.svar.leda.budskap.varfor = kursledare.svar.leda.budskap.varfor;
  anna.svar.leda.mandat.fritt.push("Testa på påhittat", "Ny rad");
  anna.beslut.push({ id: "b-anna", block: "leda", text: "Vi startar forumet", klass: "", ansvarig: "", datum: "" }, { id: "b-2", block: "forsta", text: "Ta reda på kostnaden", klass: "", ansvarig: "", datum: "" });
  kursledare.svar.leda.budskap.experiment = "Därför att ingen vet";

  const { S, rapport } = M.slaIhop(kursledare, anna, "Anna");
  assert.equal(S.svar.generera.ideer.length, 2);
  assert.equal(S.svar.generera.experiment.length, 1);
  assert.equal(S.svar.generera.experiment[0].resultat, "Halva tiden");
  assert.equal(S.svar.generera.experiment[0].status, "lyckat");
  assert.equal(S.svar.bedoma.placering.idag.forum, "hatt", "kursledarens klassning står kvar");
  assert.equal(S.svar.bedoma.placering.idag.tid, "hatt", "saknad klassning fylls i");
  assert.deepEqual(rapport.oenighet.map((o) => `${o.id}:${o.vi}>${o.de}`), ["forum:hatt>frisyr"]);
  assert.equal(S.svar.leda.budskap.experiment, "Därför att ingen vet\n\nAnna: Därför att vi måste lära");
  assert.equal(S.svar.leda.budskap.varfor, kursledare.svar.leda.budskap.varfor);
  assert.deepEqual(S.svar.leda.mandat.fritt, ["Testa på påhittat", "Ny rad"]);
  assert.deepEqual(S.beslut.map((b) => b.id), ["b-1", "b-2"], "samma beslutstext läggs inte in två gånger");
  assert.ok(S.meta.deltagare.includes("Anna"));
  assert.equal(rapport.ideer, 1);
  assert.equal(rapport.uppdateradeExperiment, 1);

  const igen = M.slaIhop(S, anna, "Anna");
  assert.equal(igen.rapport.ideer + igen.rapport.beslut + igen.rapport.texter + igen.rapport.experiment, 0, "samma bidrag två gånger ger inget nytt");

  const annan = M.nyttTillstand({ ...exempel(), organisation: "Annat AB" });
  assert.throws(() => M.slaIhop(kursledare, annan, "X"), /organisation/);
});

test("bidragets namn följer med filen", () => {
  const S = fylltTillstand();
  const data = M.sparbart(S);
  data.meta = { ...data.meta, av: "Bertil" };
  assert.equal(M.lasFil(JSON.stringify(data)).S.meta.av, "Bertil");
});

test("kursfilsverktyget: id, AI-svar, varningar och tankstreck", () => {
  const ids = new Set();
  assert.equal(M.slugId("Låta en agent skicka utkast!", ids), "lata-en-agent-skicka-utkast");
  assert.equal(M.slugId("Låta en agent skicka utkast!", ids), "lata-en-agent-skicka-utkast-2");
  assert.ok(M.giltigtId(M.slugId("ÅÄÖ", new Set())));

  const svar = "Här är filen:\n```json\n" + JSON.stringify({
    organisation: "Kund AB", beskrivning: "ett bolag", caseforslag: ["A?", "B?"],
    beslutskort: [{ text: "Byta leverantör", forslag: "tatuering" }, { id: "BAD ID", text: "Testa verktyg", forslag: "hatt" }],
    uppgiftskort: [{ text: "Fakturera", svar: "auto" }],
    _saknas: ["Beslutsordning saknas"],
  }) + "\n```\nLycka till";
  const r = M.tolkaAiSvar(svar);
  assert.equal(r.kursfil.organisation, "Kund AB");
  assert.deepEqual(r.kursfil.beslutskort.map((b) => b.id), ["byta-leverantor", "testa-verktyg"]);
  assert.deepEqual(r.saknas, ["Beslutsordning saknas"]);
  assert.throws(() => M.tolkaAiSvar("inget json här"));

  const v = M.kursfilVarningar(r.kursfil);
  assert.ok(v.some((x) => /beslutskort/.test(x)));
  assert.ok(v.some((x) => /frisyr/.test(x)));
  assert.equal(M.kursfilVarningar(exempel()).filter((x) => !/organisationens namn/.test(x)).length, 0, "mallen är komplett");

  const med = { ...exempel(), beskrivning: "ett bolag – med streck, 3–5 erbjudanden" };
  assert.equal(M.tankstreckIKursfil(med), 2);
  assert.equal(M.bytTankstreck(med).beskrivning, "ett bolag, med streck, 3 till 5 erbjudanden");

  const ut = M.kursfilTillJson({ ...r.kursfil, beslutskort: [...r.kursfil.beslutskort, { id: "", text: "Nytt beslut", forslag: "frisyr", motivering: "" }] });
  assert.equal(ut.format, M.FORMAT_KURSFIL);
  assert.equal(ut.beslutskort[2].id, "nytt-beslut");
  assert.match(ut._om, /Kund AB/);
  assert.equal(M.lasKursfil(ut).beslutskort.length, 3);
});

test("varje block har grunder före gissningarna, och Leda har spårbundenhet", () => {
  for (const b of kurs.block) {
    assert.ok(b.grund.length >= 3 && b.grund.length <= 6, b.id);
    for (const g of b.grund) assert.ok(g.rubrik && g.punkter.length >= 2, `${b.id}: ${g.rubrik}`);
  }
  const leda = kurs.block.find((b) => b.id === "leda");
  assert.ok(leda.grund.some((g) => /Spårbundenhet/.test(g.rubrik) && /Sydow/.test(g.kalla)));
  assert.ok(leda.grund.some((g) => /Innovatörens dilemma/.test(g.rubrik) && /Christensen/.test(g.kalla)));
  assert.ok(leda.lara.some((k) => k.id === "polaroid"));
  assert.equal(leda.prova[0], "spar");
});

test("våra spår sparas, slås ihop och syns i spelboken", () => {
  const S = fylltTillstand();
  S.svar.leda.spar = { framgang: "Långa kundrelationer", laser: "Timpriset", bryta: "Pröva fast pris" };
  const T = M.lasTillstand(M.sparbart(S));
  assert.deepEqual(T.svar.leda.spar, S.svar.leda.spar);
  const B = M.lasTillstand(M.sparbart(S));
  B.svar.leda.spar.laser = "Vår bild av oss som timkonsulter";
  const { S: ihop } = M.slaIhop(T, B, "Anna");
  assert.equal(ihop.svar.leda.spar.laser, "Timpriset\n\nAnna: Vår bild av oss som timkonsulter");
  const html = M.spelbokHtml(ihop, kurs, {});
  assert.match(html, /Våra spår/);
  assert.match(html, /Pröva fast pris/);
});
