import test from "node:test";
import assert from "node:assert/strict";
import kurs from "../publik/innehall/kurs.js";
import * as M from "../publik/modell.js";

const VYER = ["start", "spelbok", "arbete", ...M.BLOCK];

test("varje moduls steg pekar på sidor, övningar och delar som finns", () => {
  for (const id of M.MODULER) {
    const steg = M.modulSteg(kurs, id);
    assert.ok(steg.length >= 5, `${id} har för få steg`);
    assert.ok(steg[steg.length - 1].avslut, `${id} slutar inte med att spelboken sparas`);
    assert.equal(steg.filter((s) => s.avslut).length, 1, `${id} har fler än ett avslutande steg`);
    for (const s of steg) {
      assert.ok(VYER.includes(s.vy), `${id}: okänd sida ${s.vy}`);
      assert.ok(s.rubrik && s.text, `${id}: steg utan rubrik eller text`);
      assert.ok(!/[–—]/.test(s.rubrik + s.text), `${id}: tankstreck i ${s.rubrik}`);
      if (!M.BLOCK.includes(s.vy)) continue;
      const b = kurs.block.find((x) => x.id === s.vy);
      assert.ok(s.delar.length, `${id}: ${s.rubrik} använder ingen del av sidan`);
      for (const d of s.delar) {
        assert.ok(M.giltigDel(d), `${id}: okänd del ${d}`);
        if (d.startsWith("ov-")) assert.ok(b.prova.includes(d.slice(3)), `${id}: ${d} finns inte på ${s.vy}`);
        if (d === "experimenten") assert.ok(b.redovisa.experiment, `${id}: experimenten redovisas inte på ${s.vy}`);
        if (d === "redovisa") assert.ok(!b.redovisa.experiment, `${id}: ${s.vy} har experimenten, inte redovisa`);
        if (d === "utvardering") assert.equal(s.vy, "leda");
      }
      if (s.pres) assert.ok(["alla", "grund", "gissa"].includes(s.pres));
    }
  }
});

test("varje övning och varje del av blocksidorna används i någon modul", () => {
  for (const b of kurs.block) {
    const delar = [...b.prova.map((x) => `ov-${x}`), "grunderna", "gissa", b.redovisa.experiment ? "experimenten" : "redovisa", "avslut", "besluta"];
    for (const d of delar) assert.ok(M.modulerSomAnvander(kurs, b.id, d).length, `${b.id}/${d} används inte i någon modul`);
  }
});

test("modul 1 följer kursplanen: Generera bara grunderna, inga gissningar, prompter eller redovisning", () => {
  const m1 = M.modulSteg(kurs, "m1");
  const anv = (vy, d) => m1.some((s) => s.vy === vy && s.delar.includes(d));
  assert.ok(anv("generera", "grunderna"));
  assert.ok(!anv("generera", "gissa"));
  assert.ok(!anv("generera", "ov-prompter"));
  assert.ok(!anv("generera", "experimenten"));
  assert.ok(anv("generera", "ov-experiment") && anv("generera", "besluta"));
  assert.equal(m1.find((s) => s.vy === "generera" && s.pres).pres, "grund");
  assert.equal(M.modulSteg(kurs, "m3").find((s) => s.vy === "generera" && s.pres).pres, "gissa");
});

test("modulläget sparas i spelboken och läses försiktigt", () => {
  const S = M.nyttTillstand(M.lasKursfil({ format: M.FORMAT_KURSFIL, organisation: "Test AB (påhittat)" }));
  assert.equal(M.nastaModul(S), "m1");
  S.meta.modul = "m2";
  S.meta.steg = 3;
  S.meta.klara = [{ id: "m1", datum: "2026-11-06" }];
  const T = M.lasTillstand(JSON.parse(JSON.stringify(M.sparbart(S))));
  assert.equal(T.meta.modul, "m2");
  assert.equal(T.meta.steg, 3);
  assert.deepEqual(T.meta.klara, [{ id: "m1", datum: "2026-11-06" }]);
  assert.equal(M.nastaModul(T), "m2");

  const skrap = M.lasTillstand({ ...M.sparbart(S), meta: { modul: "m9", steg: "<b>", klara: [{ id: "m1", datum: "x" }, { id: "m1" }, { id: "hack" }, "m2"] } });
  assert.equal(skrap.meta.modul, "");
  assert.equal(skrap.meta.steg, 0);
  assert.deepEqual(skrap.meta.klara, [{ id: "m1", datum: "" }]);
  assert.equal(M.lasTillstand({ ...M.sparbart(S), meta: { steg: 999 } }).meta.steg, 40);
});

test("avslutade moduler syns i spelboken och följer med vid sammanslagning", () => {
  const k = M.lasKursfil({ format: M.FORMAT_KURSFIL, organisation: "Test AB (påhittat)" });
  const A = M.nyttTillstand(k);
  const B = M.nyttTillstand(k);
  A.meta.klara = [{ id: "m1", datum: "2026-11-06" }];
  B.meta.klara = [{ id: "m1", datum: "2026-11-06" }, { id: "m2", datum: "2026-11-27" }];
  const { S } = M.slaIhop(A, B, "Kim");
  assert.deepEqual(S.meta.klara.map((x) => x.id), ["m1", "m2"]);
  const html = M.spelbokHtml(S, kurs);
  assert.match(html, /Avslutat: Modul 1 2026-11-06, Modul 2 2026-11-27/);
  assert.ok(!/Avslutat/.test(M.spelbokHtml(M.nyttTillstand(k), kurs)));
});

test("en ny startspelbok föreslår modul 1", () => {
  const k = M.lasKursfil({ format: M.FORMAT_KURSFIL, organisation: "Test AB (påhittat)" });
  const S = M.startspelbok(k, [{ namn: "Kim Testsson", uppgift: "Sammanställa veckorapporten" }]);
  assert.equal(S.meta.modul, "");
  assert.equal(M.nastaModul(S), "m1");
});

test("förloppet räknar planerad tid och läget mot klockan", () => {
  for (const [id, total] of [["m1", 120], ["m2", 115], ["m3", 105], ["m4", 115], ["uppfoljning", 60]]) {
    const st = M.modulSteg(kurs, id);
    assert.equal(M.modulTid(st, 0).total, total, `${id} summerar inte till kursplanens tid`);
    assert.ok(st.every((x) => Number.isFinite(x.min) && x.min >= 0));
  }
  const m1 = M.modulSteg(kurs, "m1");
  const start = Date.UTC(2026, 10, 6, 8, 0);
  const vid = (min) => start + min * 60000;
  assert.deepEqual(M.modulTid(m1, 2, 0), { total: 120, planStart: 20, planSlut: 55, gatt: null, avvikelse: null });
  assert.equal(M.modulTid(m1, 2, start, vid(30)).avvikelse, 0);
  assert.equal(M.modulTid(m1, 2, start, vid(62)).avvikelse, 7);
  assert.equal(M.modulTid(m1, 2, start, vid(15)).avvikelse, -5);
  assert.equal(M.modulTid(m1, 2, start, vid(15)).gatt, 15);
  const S = M.nyttTillstand(M.lasKursfil({ format: M.FORMAT_KURSFIL, organisation: "Test AB (påhittat)" }));
  S.meta.startad = start;
  assert.equal(M.lasTillstand(M.sparbart(S)).meta.startad, start);
  assert.equal(M.lasTillstand({ ...M.sparbart(S), meta: { startad: "igår" } }).meta.startad, 0);
});
