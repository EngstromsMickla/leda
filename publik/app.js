// Leda i AI-takt: vyerna. All text läggs in med DOM-metoder och textContent, aldrig som HTML.
// Tillståndet hålls i minnet och i flikens sessionStorage (borta när fliken stängs). Inget skickas någonstans.

import kurs from "./innehall/kurs.js";
import * as M from "./modell.js";

const NYCKEL = "leda-i-ai-takt-v1";
const UI_NYCKEL = "leda-i-ai-takt-ui";
const MAX_FIL = 3 * 1024 * 1024;

let S = null;
let osparat = false;
const visade = new Set(); // vilka kunskapskort som har visat svaret (bara i minnet)
let lage = "idag"; // aktivt läge i sorteringsövningen
let visaForslag = false;
let pres = null; // { block, i, visat }
let ui = { stor: false };
let visaUppgiftsforslag = false;
let lankVal = "las"; // "las" (lösenfras), "data" (utan lösenfras) eller "ingen"
let lankFras = ""; // bara i minnet, aldrig i fliken eller filen
let lasKod = null; // en låst länk som väntar på lösenfras
let lasTill = "spelbok";
let rensaKlar = 0;

// ---------- Byggstenar ----------

function h(tag, attr = {}, ...barn) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attr || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "value") el.value = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const b of barn.flat(Infinity)) {
    if (b === null || b === undefined || b === false) continue;
    el.append(b instanceof Node ? b : document.createTextNode(String(b)));
  }
  return el;
}
const p = (text, cls) => h("p", { class: cls, text });
// Som replaceChildren, men plattar ut listor och hoppar över tomma värden.
function fyll(el, ...barn) {
  el.replaceChildren(...barn.flat(Infinity).filter((b) => b !== null && b !== undefined && b !== false && b !== ""));
}
const knapp = (text, onclick, cls, extra = {}) => h("button", { type: "button", class: cls, onclick, ...extra }, text);
const K = () => S.kursfil;
const blockAv = (id) => kurs.block.find((b) => b.id === id);

// ---------- Lagring i fliken ----------

let sparTimer = null;
function andrat(direkt = false) {
  osparat = true;
  clearTimeout(sparTimer);
  if (direkt) spara(); else sparTimer = setTimeout(spara, 300);
  visaStatus();
}
function spara() {
  try { sessionStorage.setItem(NYCKEL, JSON.stringify({ data: M.sparbart(S), osparat })); } catch { /* bara i minnet */ }
}
function aterstall() {
  try {
    const raw = sessionStorage.getItem(NYCKEL);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S = M.lasTillstand(d.data);
    osparat = d.osparat === true;
    return true;
  } catch { return false; }
}
function sparaUi() { try { sessionStorage.setItem(UI_NYCKEL, JSON.stringify(ui)); } catch { /* ingen lagring */ } }
function lasUi() { try { ui = { stor: false, ...JSON.parse(sessionStorage.getItem(UI_NYCKEL) || "{}") }; } catch { /* standard */ } }

function harArbete() {
  const s = S.svar;
  return S.beslut.length > 0 || s.generera.ideer.length > 0 || s.generera.experiment.length > 0 ||
    Object.keys(s.forsta.uppgifter).length > 0 || Object.keys(s.bedoma.placering.idag).length > 0 ||
    !!(s.leda.budskap.varfor || s.forsta.redovisa.overraskade || s.forsta.f1.skillnad);
}

window.addEventListener("beforeunload", (e) => {
  if (S && osparat && harArbete()) { e.preventDefault(); e.returnValue = ""; }
});

// ---------- Filer ----------

function laddaNer(namn, text, typ) {
  const url = URL.createObjectURL(new Blob([text], { type: typ }));
  const a = h("a", { href: url, download: namn });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function slug(s) {
  return (s || "ledningen").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "ledningen";
}

let loggaData = "";
async function logga() {
  if (loggaData) return loggaData;
  try {
    const blob = await (await fetch("img/mickla.png")).blob();
    loggaData = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(""); r.readAsDataURL(blob); });
  } catch { loggaData = ""; }
  return loggaData;
}

async function byggSpelbok() {
  const origin = /^https?:/.test(location.protocol) ? location.origin : "";
  let lank = "";
  try {
    if (lankVal === "las") lank = await M.packaLast(S, lankFras);
    else if (lankVal === "data") lank = await M.packa(S);
  } catch { lank = ""; }
  return M.spelbokHtml(S, kurs, { origin, lank, lankTyp: lankVal === "las" ? "las" : "data", logga: await logga() });
}

function lankKlar() {
  if (lankVal === "las" && lankFras.length < M.MIN_FRAS) {
    flash(`Välj en lösenfras på minst ${M.MIN_FRAS} tecken, eller välj en länk utan lösenfras.`, true);
    if (rutt().vy !== "spelbok") { render.hoppa = true; location.hash = "#spelbok/spara"; }
    else document.querySelector('[data-fokus="fras"]')?.focus();
    return false;
  }
  return true;
}

async function sparaSpelbok() {
  if (!lankKlar()) return;
  const html = await byggSpelbok();
  laddaNer(`Spelbok_${slug(K().organisation)}_${M.idag()}.html`, html, "text/html");
  osparat = false;
  spara();
  visaStatus();
  flash("Spelboken är sparad. Spara filen där ledningen hittar den.");
}

async function oppnaSpelbok() {
  if (!lankKlar()) return;
  const flik = window.open("", "_blank");
  const html = await byggSpelbok();
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  if (flik) flik.location.href = url; else location.assign(url);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

const filval = h("input", { type: "file", accept: ".json,.html,.htm,application/json,text/html", hidden: true });
document.body.append(filval);
filval.addEventListener("change", async () => {
  const fil = filval.files[0];
  filval.value = "";
  if (!fil) return;
  try {
    if (fil.size > MAX_FIL) throw new Error("storlek");
    const r = M.lasFil(await fil.text());
    if (r.typ === "kursfil") {
      S = harArbete() && r.kursfil.organisation === K().organisation ? M.lasTillstand({ ...M.sparbart(S), kursfil: r.kursfil }) : M.nyttTillstand(r.kursfil);
      if (!S.meta.grupp) S.meta.grupp = r.kursfil.grupp;
      andrat(true);
      flash(`Kursfilen för ${r.kursfil.organisation} är inläst.`);
    } else {
      S = r.S;
      osparat = false;
      spara();
      flash("Spelboken är inläst. Ni fortsätter där ni slutade.");
    }
    render();
  } catch (err) {
    console.error(err);
    flash("Filen gick inte att läsa. Välj en kursfil (.json) eller en spelbok (.html) från den här kursen.", true);
  }
});
const valjFil = () => filval.click();

// ---------- Kopiera ----------

async function kopiera(text, knappEl) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
  if (!ok) {
    const ta = h("textarea", { class: "dold-kopia", readonly: true }, text);
    document.body.append(ta);
    ta.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
  }
  if (knappEl) {
    const fore = knappEl.textContent;
    knappEl.textContent = ok ? "Kopierad" : "Markera och kopiera själv";
    setTimeout(() => { knappEl.textContent = fore; }, 1800);
  }
}

function promptruta(mall) {
  const text = mall.replaceAll("{beskrivning}", K().beskrivning || "ett svenskt kunskapsföretag");
  const kopiaKnapp = knapp("Kopiera", (e) => kopiera(text, e.currentTarget), "liten-knapp");
  return h("div", { class: "prompt" },
    h("div", { class: "prompt-huvud" }, h("span", { text: "Att kopiera till ert AI-verktyg" }), kopiaKnapp),
    h("pre", { text }));
}

// ---------- Fält ----------

let faltRaknare = 0;
function falt(etikett, varde, satt, { rader = 3, platshallare = "", max = 3000, typ = "area", fokus = "" } = {}) {
  faltRaknare += 1;
  const id = `f${faltRaknare}`;
  const attr = { id, placeholder: platshallare, maxlength: max, "data-fokus": fokus || null };
  const el = typ === "area"
    ? h("textarea", { ...attr, rows: rader }, varde || "")
    : h("input", { ...attr, type: typ, value: varde || "" });
  el.addEventListener("input", () => { satt(el.value); andrat(); });
  return h("label", { class: "falt-rad", for: id }, h("span", { text: etikett }), el);
}

function valrad(namn, val, aktivt, satt, { aria = "" } = {}) {
  return h("div", { class: "segment", role: "group", "aria-label": aria || namn },
    val.map(([v, text]) => knapp(text, () => satt(v), v === aktivt ? "seg vald" : "seg", { "aria-pressed": v === aktivt ? "true" : "false", "data-fokus": `${namn}-${v}` })));
}

// ---------- Sidhuvud, status, sidfot ----------

const DOLDA = ["kursfil"];
const MENY = [["start", "Start"], ["forsta", "Förstå"], ["bedoma", "Bedöma"], ["generera", "Generera"], ["leda", "Leda"], ["spelbok", "Spelbok"], ["guide", "Så går det till"]];

function rutt() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [vy, ankare] = raw.split("/");
  return { vy: MENY.some(([id]) => id === vy) || DOLDA.includes(vy) ? vy : "start", ankare: ankare || "" };
}

function visaMeny() {
  const { vy } = rutt();
  document.getElementById("meny").replaceChildren(...MENY.map(([id, namn]) =>
    h("a", { href: `#${id}`, "aria-current": id === vy ? "page" : null }, namn)),
  knapp(ui.stor ? "Normal text" : "Storskärm", () => { ui.stor = !ui.stor; sparaUi(); document.body.classList.toggle("stor", ui.stor); visaMeny(); }, "lank-knapp", { "aria-pressed": ui.stor ? "true" : "false" }));
}

function visaStatus() {
  const ruta = document.getElementById("status");
  if (!S || lasKod) { ruta.hidden = true; return; }
  ruta.hidden = false;
  fyll(document.getElementById("status-text"),
    h("b", { text: K().organisation }),
    S.meta.grupp ? ` · ${S.meta.grupp}` : "",
  );
  fyll(document.getElementById("status-hoger"),
    osparat && harArbete() ? h("span", { class: "osparat", text: "Ändringar som inte är sparade i spelboken" }) : null,
    knapp("Spara spelboken", () => { if (rutt().vy === "spelbok") sparaSpelbok(); else { render.hoppa = true; location.hash = "#spelbok/spara"; } }, "liten-knapp"),
  );
}

let flashTimer = null;
function flash(text, fel = false) {
  let t = document.getElementById("toast");
  if (!t) { t = h("div", { id: "toast", role: "status" }); document.body.append(t); }
  t.className = fel ? "toast fel" : "toast";
  t.textContent = text;
  t.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { t.hidden = true; }, 4200);
}

// ---------- Rendering ----------

function render() {
  const { vy, ankare } = rutt();
  const fokus = document.activeElement?.dataset?.fokus;
  const y = window.scrollY;
  const sammaVy = render.senast === vy;
  render.senast = vy;
  visaMeny();
  visaStatus();
  const mal = document.getElementById("vy");
  const vyer = { start: vStart, spelbok: vSpelbok, guide: vGuide, kursfil: vKursfil };
  fyll(mal, lasKod ? vLas() : (vyer[vy] || (() => vBlock(blockAv(vy))))());
  if (vy === "kursfil") visaVarningar();
  document.title = vy === "start" ? kurs.namn : `${(MENY.find(([id]) => id === vy) || [0, kurs.kursfilverktyg.rubrik])[1]} · ${kurs.namn}`;
  if (fokus) {
    const el = mal.querySelector(`[data-fokus="${CSS.escape(fokus)}"]`);
    if (el) el.focus({ preventScroll: true });
  }
  if (render.hoppa && ankare) {
    const el = document.getElementById(ankare);
    if (el) el.scrollIntoView({ block: "start" });
  } else if (sammaVy && !render.hoppa) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  render.hoppa = false;
}
const omrita = () => render();

window.addEventListener("hashchange", () => {
  if (/^#(data|las)=/.test(location.hash)) { lasLank(); return; }
  render.hoppa = true;
  render();
});

// ---------- Delar som återkommer ----------

function rubrikrad(eyebrow, rubrik, ingress) {
  return [h("div", { class: "eyebrow", text: eyebrow }), h("h1", { text: rubrik }), ingress ? p(ingress, "lead") : null];
}

function varvkarta(blockId) {
  return h("ol", { class: "varv" }, kurs.varv.map((v) =>
    h("li", {}, blockId ? h("a", { href: `#${blockId}/${v.id}` }, h("b", { text: v.namn }), h("span", { text: v.text })) : h("div", {}, h("b", { text: v.namn }), h("span", { text: v.text })))));
}

function nivaremsa() {
  const bn = K().beslutsnivaer;
  const steg = [["ide", "Idé"], ["hatt", "Hatt"], ["frisyr", "Frisyr"], ["tatuering", "Tatuering"]];
  return h("div", {},
    h("ol", { class: "nivaer" }, steg.map(([id, namn]) => h("li", { class: `niva ${id}` },
      h("b", { text: namn }), bn[id].text ? h("span", { text: bn[id].text }) : null,
      bn[id].grans ? h("span", { text: bn[id].grans }) : null,
      bn[id].vem ? h("em", { text: bn[id].vem }) : null))),
    bn.kalla ? p(`Källa: ${bn.kalla}`, "hjalp") : null);
}

function kursfilDel(typ) {
  const k = K();
  if (typ === "sammanhang" && k.sammanhang.length) {
    return h("div", { class: "kursfil-del" }, h("div", { class: "eyebrow", text: `Hos ${k.organisation}` }),
      k.sammanhang.map((s) => h("div", { class: "kf-stycke" }, h("h4", { text: s.rubrik }), p(s.text))));
  }
  if (typ === "spelregler") {
    const sr = k.spelregler;
    return h("div", { class: "kursfil-del" }, h("div", { class: "eyebrow", text: `Hos ${k.organisation}` }),
      sr.principer.length ? h("ul", { class: "principer" }, sr.principer.map((x) => h("li", {}, h("b", { text: `${x.rubrik}. ` }), x.text))) : null,
      sr.regler.length ? h("ul", { class: "regler" }, sr.regler.map((r) => h("li", { text: r }))) : null,
      sr.kalla ? p(`Källa: ${sr.kalla}`, "hjalp") : null);
  }
  if (typ === "beslutsnivaer") {
    return h("div", { class: "kursfil-del" }, h("div", { class: "eyebrow", text: `Hos ${k.organisation}` }), nivaremsa());
  }
  return null;
}

function kunskapskortInnehall(kort) {
  return [
    kort.svar.map((s) => p(s)),
    kort.ledning ? h("p", { class: "ledningsfraga" }, h("b", { text: "Fråga till ledningen: " }), kort.ledning) : null,
    kort.kursfil ? kursfilDel(kort.kursfil) : null,
    kort.kalla ? p(`Källa: ${kort.kalla}`, "hjalp") : null,
  ];
}

function etikettrad(ov) {
  return h("div", { class: "etiketter" },
    h("span", { class: "etikett vem", text: ov.vem }),
    h("span", { class: "etikett tid", text: ov.tid }),
    ov.info ? h("span", { class: "etikett info", text: ov.info }) : null);
}

function ovningskort(id, ...innehall) {
  const ov = kurs.ovningar[id];
  return h("section", { class: "card ovning", id: `ov-${id}` },
    h("div", { class: "eyebrow", text: "Pröva" }),
    h("h3", { class: "kortrubrik", text: ov.rubrik }), etikettrad(ov),
    ov.text ? p(ov.text) : null, ...innehall);
}

// ---------- Start ----------

function vStart() {
  const k = K();
  const exempel = /påhittat/i.test(k.organisation);
  const delt = h("textarea", { rows: 4, placeholder: "En per rad, namn eller roll", "data-fokus": "deltagare" }, S.meta.deltagare.join("\n"));
  delt.addEventListener("input", () => { S.meta.deltagare = delt.value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 30); andrat(); });

  return [
    ...rubrikrad(kurs.start.eyebrow, kurs.start.rubrik, kurs.start.ingress),
    h("p", { class: "fritt", text: kurs.start.lofte }),
    p(kurs.start.antagande),
    h("div", { class: "tvaspalt start" },
      h("section", { class: "card" },
        h("h2", { class: "kortrubrik", text: "Kursfilen" }),
        p(`Organisation: ${k.organisation}`, "tight"),
        exempel
          ? h("p", { class: "note strong" }, "Ni använder den påhittade exempelfilen. Läs in er egen kursfil, så hämtas spelregler, beslutsnivåer och exempel från er organisation.")
          : p("Spelregler, beslutsnivåer och exempel hämtas från kursfilen. Den läses bara här i webbläsaren.", "hjalp"),
        h("div", { class: "actions" },
          knapp("Läs in kursfil eller spelbok", valjFil),
          h("a", { class: "lank", href: "#kursfil" }, "Gör en ny kursfil")),
        p("Fortsätter ni från ett tidigare pass? Öppna länken i spelboken, eller läs in spelboksfilen här.", "hjalp small")),
      h("section", { class: "card" },
        h("h2", { class: "kortrubrik", text: "Vilka deltar?" }),
        falt("Gruppens namn", S.meta.grupp, (v) => { S.meta.grupp = v.slice(0, 160); }, { typ: "text", max: 160, fokus: "grupp" }),
        h("label", { class: "falt-rad" }, h("span", { text: "Deltagare (valfritt)" }), delt),
        p("Namnen används bara för att fördela experiment och beslut, och följer bara med i er egen spelbok.", "hjalp small"))),
    vFall(),
    h("h2", { text: "Varje block är ett varv" }),
    varvkarta(""),
    h("h2", { text: "Fyra block" }),
    h("div", { class: "blockkarta" }, kurs.block.map((b) => h("a", { class: "blockruta", href: `#${b.id}` },
      h("span", { class: "nr", text: String(b.nr) }), h("b", { text: b.namn }), h("span", { text: b.fraga })))),
    h("div", { class: "actions" },
      h("a", { class: "btn", href: "#forsta" }, "Börja med Förstå"),
      h("a", { class: "btn ghost", href: "#guide" }, "Så går det till och kursplan")),
    rensaKnapp(),
  ];
}

function vFall() {
  const f = kurs.fall;
  const fa = S.svar.fall;
  const forslag = K().caseforslag;
  return h("section", { class: "card fallkort", id: "fall" },
    h("div", { class: "eyebrow", text: "Det som binder ihop kursen" }),
    h("h2", { class: "kortrubrik", text: f.rubrik }),
    p(f.text),
    forslag.length ? h("div", { class: "fallforslag" }, h("span", { class: "hjalp small", text: `${f.forslagRubrik}:` }),
      forslag.map((t) => knapp(t, () => { fa.fraga = t; andrat(true); omrita(); }, fa.fraga === t ? "chip vald" : "chip", { "data-fokus": `fallforslag-${forslag.indexOf(t)}` }))) : null,
    f.falt.map((x) => falt(x.namn, fa[x.id], (v) => { fa[x.id] = v; }, { rader: x.id === "fraga" ? 2 : 3, max: x.id === "fraga" ? 600 : 3000, platshallare: x.platshallare || "", fokus: `fall-${x.id}` })));
}

function rensaKnapp() {
  const vantar = Date.now() - rensaKlar < 5000;
  return h("div", { class: "rensa" },
    knapp(vantar ? "Bekräfta: rensa allt" : "Rensa allt i den här webbläsaren", async () => {
      if (!vantar) { rensaKlar = Date.now(); omrita(); setTimeout(() => { if (Date.now() - rensaKlar >= 5000) omrita(); }, 5100); return; }
      rensaKlar = 0;
      try { sessionStorage.removeItem(NYCKEL); } catch { /* ingen lagring */ }
      lankFras = "";
      osparat = false;
      visade.clear();
      await startaNy();
      flash("Allt är rensat. Spara spelboken först nästa gång om ni vill behålla arbetet.");
      render.hoppa = true;
      location.hash = "#start";
      render();
    }, vantar ? "fara" : "ghost liten-knapp", { "data-fokus": "rensa" }),
    p("För gemensamma datorer. Tar bort allt i den här fliken. Spelböcker ni har sparat påverkas inte.", "hjalp small"));
}

// ---------- Ett block ----------

function vBlock(b) {
  const index = kurs.block.indexOf(b);
  const forra = kurs.block[index - 1];
  const nasta = kurs.block[index + 1];
  return [
    ...rubrikrad(`Block ${b.nr} av 4`, b.namn, b.fraga),
    p(b.ingress),
    h("div", { class: "malruta" },
      h("div", {}, h("div", { class: "eyebrow", text: "Efter blocket kan ni" }), h("ul", {}, b.mal.map((m) => h("li", { text: m })))),
      S.svar.fall.fraga ? h("div", {}, h("div", { class: "eyebrow", text: "Ert case" }), h("p", { class: "fallcitat", text: S.svar.fall.fraga })) : h("div", {}, h("div", { class: "eyebrow", text: "Ert case" }), h("p", { class: "hjalp" }, "Inget case valt ännu. ", h("a", { href: "#start/fall" }, "Välj ett på startsidan.")))),
    varvkarta(b.id),

    h("section", { class: "fas-sektion", id: "lara" },
      h("div", { class: "fas-huvud" }, h("h2", { text: "Lära" }),
        knapp("Presentera på storskärm", () => oppnaPres(b.id, 0), "", { "data-fokus": "presentera" })),
      p("Först grunderna, cirka fem minuter. Sedan gissningar om vad det betyder för er: läs frågan högt och låt alla gissa innan svaret visas.", "hjalp"),
      b.grund?.length ? h("div", { class: "grunderna", id: "grunderna" },
        h("div", { class: "grund-huvud" }, h("h3", { text: "Grunderna" }), knapp("Presentera grunderna", () => oppnaPres(b.id, 0), "ghost liten-knapp", { "data-fokus": "presentera-grund" })),
        h("ol", { class: "grundlista" }, b.grund.map((g) => h("li", { class: "card tight grundkort" },
          h("h4", { text: g.rubrik }),
          h("ul", {}, g.punkter.map((t) => h("li", { text: t }))),
          g.kalla ? p(`Källa: ${g.kalla}`, "hjalp small tight") : null)))) : null,
      h("div", { class: "grund-huvud" }, h("h3", { text: "Gissa och resonera" }),
        knapp("Presentera gissningarna", () => oppnaPres(b.id, (b.grund || []).length), "ghost liten-knapp", { "data-fokus": "presentera-gissa" })),
      h("div", { class: "kunskap" }, b.lara.map((kort, i) => {
        const nyckel = `${b.id}-${kort.id}`;
        const visat = visade.has(nyckel);
        return h("article", { class: visat ? "card kunskapskort visat" : "card kunskapskort", id: `kort-${kort.id}` },
          h("div", { class: "kort-nr", text: `${i + 1}` }),
          h("h3", { text: kort.rubrik }),
          h("p", { class: "gissa", text: kort.gissa }),
          visat ? kunskapskortInnehall(kort) : null,
          h("div", { class: "kort-knappar" },
            knapp(visat ? "Dölj svaret" : "Visa svaret", () => { visat ? visade.delete(nyckel) : visade.add(nyckel); omrita(); }, "ghost liten-knapp", { "data-fokus": `visa-${nyckel}` }),
            knapp("Presentera härifrån", () => oppnaPres(b.id, (b.grund || []).length + i), "lank-knapp")));
      }))),

    h("section", { class: "fas-sektion", id: "prova" },
      h("h2", { text: "Pröva" }),
      p("Övningarna görs av någon i ledningen, på storskärm eller på egen dator. Byt person mellan övningarna.", "hjalp"),
      b.prova.map((id) => OVNINGAR[id]())),

    h("section", { class: "fas-sektion", id: "redovisa" },
      h("h2", { text: "Redovisa" }), vRedovisa(b)),

    h("section", { class: "fas-sektion", id: "besluta" },
      h("h2", { text: "Besluta" }), p(b.besluta, "hjalp"),
      b.id === "generera" && !S.beslut.some((x) => x.text === kurs.startmandat) ? h("div", { class: "note strong" },
        h("b", { text: "Förslag på startmandat. " }), kurs.startmandat, " ",
        knapp("Lägg in som beslut", () => {
          S.beslut.push({ id: M.nyttId("b"), block: "generera", text: kurs.startmandat, klass: "hatt", ansvarig: S.meta.grupp || "Ledningsgruppen", datum: M.idag() });
          andrat(true); omrita();
        }, "ghost liten-knapp", { "data-fokus": "startmandat" })) : null,
      beslutslogg(b.id)),

    h("div", { class: "navrow" },
      forra ? h("a", { class: "btn ghost", href: `#${forra.id}` }, `Tillbaka till ${forra.namn}`) : h("a", { class: "btn ghost", href: "#start" }, "Till start"),
      nasta ? h("a", { class: "btn", href: `#${nasta.id}` }, `Vidare till ${nasta.namn}`) : h("a", { class: "btn", href: "#spelbok" }, "Till spelboken")),
  ];
}

function vRedovisa(b) {
  const r = b.redovisa;
  const lager = S.svar[b.id].redovisa;
  const ut = [h("h3", { class: "underrubrik", text: r.rubrik }), p(r.text, "hjalp"),
    r.falt.map((f) => falt(f.namn, lager[f.id], (v) => { lager[f.id] = v; }, { rader: 3, fokus: `red-${b.id}-${f.id}` }))];
  if (r.flyttade) {
    const fl = M.flyttade(S);
    ut.push(fl.length
      ? h("div", { class: "card tight" }, h("h4", { text: "Beslut som bytte klass när gränserna flyttades" }),
        h("ul", {}, fl.map((f) => h("li", {}, `${f.kort.text}: `, h("b", { text: `${klassNamn(f.fran)} blir ${klassNamn(f.till)}` }), ` ${lagesNamn(f.lage)}`))))
      : p("Inga beslut har bytt klass ännu. Gör övningen Sortera besluten i alla tre lägena.", "hjalp"));
  }
  if (r.experiment) ut.push(experimentRedovisning());
  const bl = S.svar[b.id];
  ut.push(h("div", { class: "card tillbaka", id: "fall-tillbaka" },
    h("div", { class: "eyebrow", text: "Tillbaka till ert case" }),
    S.svar.fall.fraga ? h("p", { class: "fallcitat", text: S.svar.fall.fraga }) : null,
    falt(b.fallFraga, bl.fall, (v) => { bl.fall = v; }, { rader: 3, fokus: `fall-${b.id}` })));
  ut.push(h("div", { class: "card tight sjalvskattning" },
    h("h4", { text: "Kan ni det nu?" }),
    p("Skatta er gemensamt mot blockets lärandemål. Svaret hamnar i spelboken.", "hjalp small"),
    h("ul", { class: "mallista" }, b.mal.map((m, i) => h("li", {}, h("span", { text: m }),
      valrad(`mal-${b.id}-${i}`, kurs.sjalvskattning, bl.mal[i], (v) => { bl.mal[i] = v; andrat(); omrita(); }, { aria: m }))))));
  return ut;
}

const klassNamn = (id) => kurs.klasser.find((k) => k.id === id)?.namn || "";
const lagesNamn = (id) => ({ billigt: "om det blir billigt att bygga", last: "om kunddata låses fast" }[id] || "");

// ---------- Beslutsloggen ----------

function beslutslogg(blockId) {
  const alla = blockId === "leda";
  const lista = S.beslut.filter((b) => alla || b.block === blockId);
  const ny = { text: "", klass: "", ansvarig: "", datum: "" };
  const text = h("input", { type: "text", maxlength: 600, placeholder: "Vi beslutar att ...", "data-fokus": `beslut-text-${blockId}` });
  const klass = h("select", {}, h("option", { value: "" }, "Klass (valfritt)"), kurs.klasser.map((k) => h("option", { value: k.id }, k.namn)));
  const ansvarig = ansvarigFalt(`beslut-ansv-${blockId}`);
  const datum = h("input", { type: "date" });
  const lagg = () => {
    ny.text = text.value.trim();
    if (!ny.text) { text.focus(); return; }
    S.beslut.push({ id: M.nyttId("b"), block: blockId, text: ny.text.slice(0, 600), klass: klass.value, ansvarig: ansvarig.value.trim().slice(0, 80), datum: datum.value });
    andrat(true);
    omrita();
  };
  text.addEventListener("keydown", (e) => { if (e.key === "Enter") lagg(); });
  return h("div", { class: "logg" },
    lista.length ? h("ul", { class: "logglista" }, lista.map((b) => h("li", {},
      h("div", {}, h("b", { text: b.text }),
        h("span", { class: "hjalp small" }, [alla ? blockAv(b.block).namn : "", b.klass ? klassNamn(b.klass) : "", b.ansvarig, b.datum].filter(Boolean).join(" · "))),
      knapp("Ta bort", () => { S.beslut = S.beslut.filter((x) => x.id !== b.id); andrat(true); omrita(); }, "lank-knapp")))) : p(alla ? "Inga beslut ännu." : "Inga beslut i det här blocket ännu.", "hjalp"),
    h("div", { class: "loggform" },
      h("label", { class: "falt-rad bred" }, h("span", { text: "Beslut" }), text),
      h("label", { class: "falt-rad" }, h("span", { text: "Klass" }), klass),
      h("label", { class: "falt-rad" }, h("span", { text: "Ansvarig" }), ansvarig),
      h("label", { class: "falt-rad" }, h("span", { text: "Datum" }), datum),
      knapp("Lägg till beslut", lagg, "", { "data-fokus": `beslut-lagg-${blockId}` })));
}

function ansvarigFalt(fokus, varde = "") {
  const listId = "deltagarlista";
  if (!document.getElementById(listId)) document.body.append(h("datalist", { id: listId }));
  document.getElementById(listId).replaceChildren(...S.meta.deltagare.map((d) => h("option", { value: d })));
  return h("input", { type: "text", list: listId, maxlength: 80, value: varde, placeholder: "Namn eller roll", "data-fokus": fokus });
}

// ---------- Övningar: Förstå ----------

const OVNINGAR = {
  "samma-fraga": () => {
    const ov = kurs.ovningar["samma-fraga"];
    const f1 = S.svar.forsta.f1;
    return ovningskort("samma-fraga",
      h("ol", { class: "lista-steg" }, ov.steg.map((s) => h("li", { text: s }))),
      promptruta(ov.prompt),
      ov.falt.map((f) => falt(f.namn, f1[f.id], (v) => { f1[f.id] = v; }, { fokus: `f1-${f.id}` })));
  },

  uppgifter: () => {
    const val = S.svar.forsta.uppgifter;
    const kom = S.svar.forsta.kommentar;
    const lista = K().uppgiftskort;
    const klara = lista.filter((u) => val[u.id]);
    const lika = klara.filter((u) => u.svar && val[u.id] === u.svar).length;
    return ovningskort("uppgifter",
      h("div", { class: "uppgiftslista" }, lista.map((u) => {
        const v = val[u.id];
        const forslag = kurs.uppgiftsval.find((x) => x.id === u.svar);
        return h("div", { class: v ? "uppgift klar" : "uppgift" },
          h("p", { class: "uppgift-text", text: u.text }),
          valrad(`upp-${u.id}`, kurs.uppgiftsval.map((x) => [x.id, x.namn]), v, (ny) => { val[u.id] = ny; andrat(); omrita(); }, { aria: u.text }),
          visaUppgiftsforslag && v && forslag ? h("div", { class: v === u.svar ? "forslag lika" : "forslag olika" },
            h("b", { text: v === u.svar ? `Kursens förslag är också ${forslag.namn}. ` : `Kursens förslag: ${forslag.namn}. ` }), u.motivering) : null,
          visaUppgiftsforslag && v && u.svar && v !== u.svar ? falt("Varför valde ni annorlunda?", kom[u.id], (t) => { kom[u.id] = t; }, { rader: 2, max: 600, fokus: `kom-${u.id}` }) : null);
      })),
      h("div", { class: "actions" },
        knapp(visaUppgiftsforslag ? "Dölj kursens förslag" : "Visa kursens förslag", () => { visaUppgiftsforslag = !visaUppgiftsforslag; omrita(); }, visaUppgiftsforslag ? "ghost" : "", { "data-fokus": "visa-uppgiftsforslag" }),
        p(klara.length < lista.length ? `Ni har valt för ${klara.length} av ${lista.length} uppgifter. Välj för alla innan ni tittar.` : visaUppgiftsforslag ? `Ni valde som kursens förslag i ${lika} av ${lista.length}. Diskutera skillnaderna.` : "Alla är valda. Visa förslagen och diskutera skillnaderna.", "hjalp tight")));
  },

  kostnad: () => {
    const ov = kurs.ovningar.kostnad;
    const v = S.svar.forsta.kostnad || { ...K().kostnad };
    const utdata = h("div", { class: "kalkyl-ut" });
    const visa = () => {
      const r = M.kostnadBerakna(v);
      utdata.replaceChildren(
        rad("Användning per år", r.anvandning), rad("Licenser per år", r.licenser), rad("Agenter per år", r.agenter),
        rad("Totalt per år", r.totalt, true), rad("Om användningen fyrdubblas", r.fyrdubbel));
    };
    const rad = (namn, tal, stor) => h("div", { class: stor ? "kalk-rad summa" : "kalk-rad" }, h("span", { text: namn }), h("b", { text: M.kr(tal) }));
    visa();
    return ovningskort("kostnad",
      h("div", { class: "kalkyl" },
        h("div", { class: "kalkyl-in" }, ov.falt.map((f) => {
          const el = h("input", { type: "number", min: f.min, max: f.max, step: f.steg, value: v[f.id], inputmode: "decimal", "data-fokus": `kost-${f.id}` });
          el.addEventListener("input", () => {
            const n = Number(el.value);
            if (!Number.isFinite(n) || el.value === "") return;
            v[f.id] = n;
            S.svar.forsta.kostnad = M.kostnadsvarden(v);
            andrat();
            visa();
          });
          return h("label", { class: "falt-rad" }, h("span", { text: f.namn }), el);
        })),
        utdata),
      p("Agentkostnaden räknas som antal körningar gånger kostnaden per fråga. I verkligheten är en agents körningar ofta längre och dyrare.", "hjalp small"),
      h("p", { class: "ledningsfraga" }, h("b", { text: "Fråga till ledningen: " }), ov.fraga));
  },

  // ---------- Bedöma ----------

  guide: () => {
    const ov = kurs.ovningar.guide;
    const g = S.svar.bedoma.guide;
    const res = M.guideForslag(g.svar);
    const bn = K().beslutsnivaer;
    return ovningskort("guide",
      falt("Beslutet vi bedömer", g.titel, (v) => { g.titel = v; }, { typ: "text", max: 160, fokus: "guide-titel", platshallare: "Till exempel: låta konsulterna använda AI i anbudsarbetet" }),
      h("ol", { class: "guidefragor" }, ov.fragor.map((q) => h("li", {},
        h("p", { class: "tight", text: q.text }),
        valrad(`guide-${q.id}`, q.val, g.svar[q.id], (v) => { g.svar[q.id] = v; andrat(); omrita(); }, { aria: q.text })))),
      res ? h("div", { class: `guide-svar ${res.klass}` },
        h("div", { class: "eyebrow", text: "Förslag" }),
        h("h4", { text: `${klassNamn(res.klass)}: ${kurs.klasser.find((k) => k.id === res.klass).text}` }),
        p(`Därför att det ${res.skal.join(" och ")}.`),
        bn[res.klass]?.vem ? p(`Beslutas av: ${bn[res.klass].vem}${bn[res.klass].grans ? `, ${bn[res.klass].grans}` : ""}.`) : null,
        g.titel.trim() ? knapp("Lägg beslutet bland korten att sortera", () => {
          const id = M.nyttId("egen");
          S.svar.bedoma.egnaKort.push({ id, text: g.titel.trim().slice(0, 160) });
          S.svar.bedoma.placering.idag[id] = res.klass;
          andrat(true);
          flash("Beslutet ligger nu bland korten i nästa övning.");
          omrita();
        }, "ghost liten-knapp") : null)
        : p("Svara på alla fem frågorna för att få ett förslag.", "hjalp"));
  },

  sortera: () => {
    const ov = kurs.ovningar.sortera;
    const pl = S.svar.bedoma.placering;
    const kort = M.allaBeslutskort(S);
    const aktuell = pl[lage];
    const lageInfo = ov.lagen.find((l) => l.id === lage);
    const placera = (id, klass) => { aktuell[id] = klass; andrat(); omrita(); };

    const kortEl = (k) => {
      const v = aktuell[k.id];
      const fran = lage !== "idag" ? pl.idag[k.id] : null;
      return h("div", { class: "beslutskort", draggable: "true", "data-id": k.id, ondragstart: (e) => { e.dataTransfer.setData("text/plain", k.id); e.dataTransfer.effectAllowed = "move"; } },
        h("p", { class: "tight", text: k.text }),
        fran && v && fran !== v ? h("span", { class: "flyttad", text: `Flyttad från ${klassNamn(fran)}` }) : null,
        visaForslag && lage === "idag" && k.forslag ? h("span", { class: `forslagsmarke ${k.forslag === v ? "lika" : "olika"}`, title: k.motivering, text: `Förslag: ${klassNamn(k.forslag)}` }) : null,
        visaForslag && lage === "idag" && k.forslag && k.motivering ? p(k.motivering, "hjalp small tight") : null,
        h("div", { class: "mini-knappar", role: "group", "aria-label": `Klassa: ${k.text}` },
          kurs.klasser.map((kl) => knapp(kl.namn, () => placera(k.id, kl.id), v === kl.id ? "mini vald" : "mini", { "aria-pressed": v === kl.id ? "true" : "false", "data-fokus": `sort-${lage}-${k.id}-${kl.id}` })),
          k.egen ? knapp("Ta bort", () => {
            S.svar.bedoma.egnaKort = S.svar.bedoma.egnaKort.filter((x) => x.id !== k.id);
            for (const l of M.LAGEN) delete pl[l][k.id];
            andrat(true); omrita();
          }, "lank-knapp") : null));
    };
    const kolumn = (klass, namn, text) => {
      const lista = kort.filter((k) => (klass ? aktuell[k.id] === klass : !aktuell[k.id]));
      return h("div", {
        class: `kolumn ${klass || "oklassad"}`,
        ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add("over"); },
        ondragleave: (e) => e.currentTarget.classList.remove("over"),
        ondrop: (e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain");
          if (!kort.some((k) => k.id === id)) return;
          if (klass) aktuell[id] = klass; else delete aktuell[id];
          andrat(); omrita();
        },
      }, h("div", { class: "kolumn-huvud" }, h("b", { text: namn }), text ? h("span", { text }) : null, h("span", { class: "antal", text: String(lista.length) })),
      lista.map(kortEl));
    };
    const egen = h("input", { type: "text", maxlength: 160, placeholder: "Ett eget beslut att klassa", "data-fokus": "egen-kort" });
    const laggEgen = () => {
      const t = egen.value.trim();
      if (!t) return;
      S.svar.bedoma.egnaKort.push({ id: M.nyttId("egen"), text: t.slice(0, 160) });
      andrat(true); omrita();
    };
    egen.addEventListener("keydown", (e) => { if (e.key === "Enter") laggEgen(); });
    const bytLage = (ny) => {
      if (ny !== "idag") for (const k of kort) if (pl.idag[k.id] && !pl[ny][k.id]) pl[ny][k.id] = pl.idag[k.id];
      lage = ny;
      andrat();
      omrita();
    };
    return ovningskort("sortera",
      h("div", { class: "flikar", role: "tablist" }, ov.lagen.map((l) => knapp(l.namn, () => bytLage(l.id), l.id === lage ? "flik vald" : "flik", { role: "tab", "aria-selected": l.id === lage ? "true" : "false", "data-fokus": `lage-${l.id}` }))),
      lageInfo.text ? h("p", { class: "note strong" }, h("b", { text: `${lageInfo.namn}. ` }), lageInfo.text, " Flytta de kort som byter klass.") : null,
      h("div", { class: "sortering" },
        kolumn("", "Inte klassade", ""),
        kurs.klasser.map((kl) => kolumn(kl.id, kl.namn, kl.kort))),
      h("div", { class: "actions" },
        lage === "idag" ? knapp(visaForslag ? "Dölj kursens förslag" : "Visa kursens förslag", () => { visaForslag = !visaForslag; omrita(); }, "ghost", { "data-fokus": "visa-forslag" }) : null,
        h("div", { class: "hoger egen-rad" }, egen, knapp("Lägg till", laggEgen, "ghost"))),
      p("Dra korten mellan kolumnerna eller använd knapparna på korten.", "hjalp small"));
  },

  // ---------- Generera ----------

  prompter: () => {
    const ov = kurs.ovningar.prompter;
    const ant = S.svar.generera.prompter;
    return ovningskort("prompter",
      ov.lista.map((x, i) => h("details", { class: "promptovning", open: i === 0 },
        h("summary", {}, h("b", { text: x.rubrik }), h("span", { class: "hjalp", text: ` ${x.syfte}` }), ant[x.id] ? h("span", { class: "klar-markering", text: "Antecknad" }) : null),
        promptruta(x.prompt),
        x.tips ? p(x.tips, "hjalp small") : null,
        h("p", { class: "ledningsfraga" }, h("b", { text: "Fråga: " }), x.fraga),
        falt("Det här såg vi", ant[x.id], (v) => { ant[x.id] = v; }, { rader: 3, fokus: `pr-${x.id}` }))));
  },

  ideer: () => {
    const ov = kurs.ovningar.ideer;
    const ideer = S.svar.generera.ideer;
    const ny = { titel: "", uppgift: "", av: "", ofta: "", samma: "", info: "" };
    const titel = h("input", { type: "text", maxlength: 160, placeholder: "Kort namn på idén", "data-fokus": "ide-titel" });
    const uppgift = h("textarea", { rows: 2, maxlength: 600, placeholder: "Vilken uppgift tar tid, återkommer eller irriterar?" });
    const av = ansvarigFalt("ide-av");
    const sel = (lista, tom) => h("select", {}, h("option", { value: "" }, tom), lista.map(([v, t]) => h("option", { value: v }, t)));
    const ofta = sel(ov.ofta, "Hur ofta?");
    const info = sel(ov.info_val, "Vilken information?");
    const samma = sel([["nej", "Nej, den tål variation"], ["ja", "Ja, samma svar varje gång"]], "Behövs samma svar varje gång?");
    const lagg = () => {
      ny.titel = titel.value.trim();
      if (!ny.titel) { titel.focus(); return; }
      ideer.push({ id: M.nyttId("ide"), titel: ny.titel.slice(0, 160), uppgift: uppgift.value.trim().slice(0, 600), av: av.value.trim().slice(0, 80), ofta: ofta.value, samma: samma.value, info: info.value });
      andrat(true); omrita();
      flash("Idén är tillagd.");
    };
    const oftaNamn = Object.fromEntries(ov.ofta);
    const infoNamn = Object.fromEntries(ov.info_val);
    return ovningskort("ideer",
      h("div", { class: "ideform" },
        h("label", { class: "falt-rad" }, h("span", { text: "Idé" }), titel),
        h("label", { class: "falt-rad" }, h("span", { text: "Föreslagen av" }), av),
        h("label", { class: "falt-rad bred" }, h("span", { text: "Uppgiften" }), uppgift),
        h("label", { class: "falt-rad" }, h("span", { text: "Hur ofta" }), ofta),
        h("label", { class: "falt-rad" }, h("span", { text: "Samma svar varje gång?" }), samma),
        h("label", { class: "falt-rad" }, h("span", { text: "Information" }), info),
        h("div", { class: "falt-rad knapp-rad" }, knapp("Lägg till idé", lagg, "", { "data-fokus": "ide-lagg" }))),
      ideer.length ? h("ul", { class: "idelista" }, ideer.map((i) => {
        const harExp = S.svar.generera.experiment.some((e) => e.ide === i.id);
        return h("li", { class: "card tight" },
          h("div", { class: "ide-huvud" }, h("b", { text: i.titel }),
            h("div", { class: "taggar" },
              i.ofta ? h("span", { class: "tagg", text: oftaNamn[i.ofta] }) : null,
              i.info ? h("span", { class: `tagg info-${i.info}`, text: infoNamn[i.info] }) : null,
              i.samma === "ja" ? h("span", { class: "tagg auto", text: "Automation snarare än AI" }) : null,
              i.samma === "nej" ? h("span", { class: "tagg ai", text: "Tål variation" }) : null)),
          i.uppgift ? p(i.uppgift, "tight") : null,
          i.av ? p(`Föreslagen av ${i.av}`, "hjalp small tight") : null,
          i.info === "kund" ? p("Kunddata: pröva först med påhittad information, och följ spelreglerna.", "hjalp small tight varning") : null,
          h("div", { class: "kort-knappar" },
            harExp ? h("span", { class: "hjalp small", text: "Har ett experimentkort" }) : knapp("Gör experimentkort", () => nyttExperiment(i), "ghost liten-knapp", { "data-fokus": `exp-fran-${i.id}` }),
            knapp("Ta bort", () => {
              S.svar.generera.ideer = ideer.filter((x) => x.id !== i.id);
              delete S.svar.leda.karta[i.id]; delete S.svar.leda.flytt[i.id];
              andrat(true); omrita();
            }, "lank-knapp")));
      })) : p("Inga idéer ännu.", "hjalp"));
  },

  experiment: () => {
    const lista = S.svar.generera.experiment;
    return ovningskort("experiment",
      lista.length ? lista.map(experimentkort) : p("Inga experimentkort ännu. Gör ett från en idé ovan, eller börja med ett tomt.", "hjalp"),
      h("div", { class: "actions" }, knapp("Nytt tomt experimentkort", () => nyttExperiment(null), "ghost", { "data-fokus": "exp-ny" })));
  },

  // ---------- Leda ----------

  spar: () => {
    const ov = kurs.ovningar.spar;
    const sp = S.svar.leda.spar;
    return ovningskort("spar",
      ov.falt.map((f) => falt(f.namn, sp[f.id], (v) => { sp[f.id] = v; }, { rader: 3, max: 3000, platshallare: f.platshallare || "", fokus: `spar-${f.id}` })),
      h("div", { class: "actions" },
        knapp("Gör ett experimentkort av det sista fältet", () => {
          const t = sp.bryta.trim();
          if (!t) { flash("Skriv först vad ni kan pröva för att bryta spåret.", true); return; }
          const forsta = t.split(/[.\n]/)[0].slice(0, 120);
          nyttExperiment({ id: "", titel: `Bryta spåret: ${forsta}`, av: "" });
          const e = S.svar.generera.experiment[S.svar.generera.experiment.length - 1];
          e.hypotes = t.slice(0, 600);
          andrat(true);
        }, "ghost", { "data-fokus": "spar-experiment" })));
  },

  budskap: () => {
    const ov = kurs.ovningar.budskap;
    const bu = S.svar.leda.budskap;
    return ovningskort("budskap",
      ov.falt.map((f) => falt(f.namn, bu[f.id], (v) => { bu[f.id] = v; }, { rader: 2, max: 600, fokus: `bu-${f.id}` })),
      p("Vill ni pröva budskapet på en skeptisk läsare? Kopiera frågan och lägg till era tre meningar.", "hjalp small"),
      promptruta(ov.prompt));
  },

  mandat: () => {
    const ov = kurs.ovningar.mandat;
    const ma = S.svar.leda.mandat;
    const bn = K().beslutsnivaer;
    const kort = M.allaBeslutskort(S);
    const idag = S.svar.bedoma.placering.idag;
    const hamta = () => {
      let n = 0;
      for (const kol of ov.kolumner) {
        for (const k of kort.filter((x) => idag[x.id] === kol.klass)) {
          if (!ma[kol.id].includes(k.text)) { ma[kol.id].push(k.text); n += 1; }
        }
      }
      andrat(true); omrita();
      flash(n ? `${n} beslut hämtades från sorteringen i Bedöma.` : "Inga nya beslut att hämta. Sortera besluten i Bedöma först.");
    };
    return ovningskort("mandat",
      h("div", { class: "mandat" }, ov.kolumner.map((kol) => {
        const niva = bn[kol.klass];
        const inp = h("input", { type: "text", maxlength: 600, placeholder: "Lägg till", "data-fokus": `ma-${kol.id}` });
        const lagg = () => { const t = inp.value.trim(); if (!t) return; ma[kol.id].push(t.slice(0, 600)); andrat(true); omrita(); };
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") lagg(); });
        return h("div", { class: `kolumn ${kol.klass}` },
          h("div", { class: "kolumn-huvud" }, h("b", { text: kol.namn }), h("span", { text: [klassNamn(kol.klass), niva?.vem, niva?.grans].filter(Boolean).join(" · ") })),
          ma[kol.id].length ? h("ul", { class: "mandatlista" }, ma[kol.id].map((t, i) => h("li", {}, h("span", { text: t }),
            knapp("Ta bort", () => { ma[kol.id].splice(i, 1); andrat(true); omrita(); }, "lank-knapp")))) : null,
          h("div", { class: "egen-rad" }, inp, knapp("Lägg till", lagg, "ghost liten-knapp")));
      })),
      h("div", { class: "actions" }, knapp("Hämta de klassade besluten från Bedöma", hamta, "ghost", { "data-fokus": "hamta" })));
  },

  takt: () => {
    const ov = kurs.ovningar.takt;
    const ta = S.svar.leda.takt;
    return ovningskort("takt",
      ov.falt.map((f) => falt(f.namn, ta[f.id], (v) => { ta[f.id] = v; }, f.typ === "date" ? { typ: "date", fokus: `ta-${f.id}` } : { typ: "text", max: 600, platshallare: f.platshallare, fokus: `ta-${f.id}` })));
  },

  karta: () => {
    const ov = kurs.ovningar.karta;
    const obj = M.kartobjekt(S);
    const flytta = (id, zon) => { S.svar.leda.karta[id] = zon; andrat(); omrita(); };
    return ovningskort("karta",
      obj.length ? h("div", { class: "zoner" }, ov.zoner.map((z) => h("div", {
        class: `kolumn zon-${z.id}`,
        ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add("over"); },
        ondragleave: (e) => e.currentTarget.classList.remove("over"),
        ondrop: (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (obj.some((o) => o.id === id)) flytta(id, z.id); },
      },
      h("div", { class: "kolumn-huvud" }, h("b", { text: z.namn }), h("span", { text: z.text })),
      obj.filter((o) => o.zon === z.id).map((o) => h("div", { class: "beslutskort", draggable: "true", ondragstart: (e) => e.dataTransfer.setData("text/plain", o.id) },
        h("p", { class: "tight" }, h("b", { text: o.titel })),
        h("span", { class: "hjalp small", text: o.typ === "experiment" ? `Experiment · ${statusNamn(o.status)}` : "Idé" }),
        z.id !== "explore" ? falt("Vad krävs för att det ska flyttas över, och vem tar emot det?", S.svar.leda.flytt[o.id], (v) => { S.svar.leda.flytt[o.id] = v; }, { rader: 2, max: 600, fokus: `fl-${o.id}` }) : null,
        h("div", { class: "mini-knappar" }, ov.zoner.map((zz) => knapp(zz.namn, () => flytta(o.id, zz.id), zz.id === z.id ? "mini vald" : "mini", { "aria-pressed": zz.id === z.id ? "true" : "false", "data-fokus": `zon-${o.id}-${zz.id}` }))))))))
        : p("Här hamnar experimenten och idéerna från Generera. Gör dem först.", "hjalp"));
  },
};

const statusNamn = (id) => Object.fromEntries(kurs.ovningar.experiment.status)[id] || "";

function nyttExperiment(ide) {
  const e = {
    id: M.nyttId("exp"), ide: ide ? ide.id : "", titel: ide ? ide.titel : "Nytt experiment", ansvarig: ide ? ide.av : "",
    hypotes: "", test: "", nulage: "", matt: "", misslyckat: "", timmar: "", stopp: "", klass: "hatt", status: "planerat", resultat: "", lardom: "", beslut: "",
  };
  S.svar.generera.experiment.push(e);
  andrat(true);
  render.hoppa = true;
  location.hash = `#generera/exp-${e.id}`;
}

function experimentkort(e) {
  const ov = kurs.ovningar.experiment;
  const ide = S.svar.generera.ideer.find((i) => i.id === e.ide);
  const sel = (lista, varde, satt, fokus) => {
    const el = h("select", { "data-fokus": fokus }, lista.map(([v, t]) => h("option", { value: v, selected: v === varde }, t)));
    el.addEventListener("change", () => { satt(el.value); andrat(); });
    return el;
  };
  const ansv = ansvarigFalt(`exp-ansv-${e.id}`, e.ansvarig);
  ansv.addEventListener("input", () => { e.ansvarig = ansv.value.slice(0, 80); andrat(); });
  return h("article", { class: "card experimentkort", id: `exp-${e.id}` },
    h("div", { class: "exp-huvud" },
      falt("Experiment", e.titel, (v) => { e.titel = v.slice(0, 160); }, { typ: "text", max: 160, fokus: `exp-titel-${e.id}` }),
      knapp("Ta bort", () => {
        S.svar.generera.experiment = S.svar.generera.experiment.filter((x) => x.id !== e.id);
        delete S.svar.leda.karta[e.id]; delete S.svar.leda.flytt[e.id];
        andrat(true); omrita();
      }, "lank-knapp")),
    ide ? p(`Från idén: ${ide.titel}`, "hjalp small") : null,
    h("div", { class: "exp-grid" },
      ov.falt.map((f) => falt(f.namn, e[f.id], (v) => { e[f.id] = v; }, { rader: 2, max: 600, platshallare: f.platshallare, fokus: `exp-${f.id}-${e.id}` })),
      h("label", { class: "falt-rad" }, h("span", { text: "Ansvarig" }), ansv),
      falt("Budget, timmar", e.timmar === "" ? "" : String(e.timmar), (v) => { const n = Number(v); e.timmar = v === "" || !Number.isFinite(n) ? "" : Math.max(0, Math.min(10000, n)); }, { typ: "number", fokus: `exp-tim-${e.id}` }),
      falt("Stoppdatum", e.stopp, (v) => { e.stopp = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ""; }, { typ: "date", fokus: `exp-stopp-${e.id}` }),
      h("label", { class: "falt-rad" }, h("span", { text: "Klass" }), sel(kurs.klasser.map((k) => [k.id, k.namn]), e.klass, (v) => { e.klass = v; }, `exp-klass-${e.id}`))),
    e.klass !== "hatt" ? p(`En ${klassNamn(e.klass).toLowerCase()} beslutas av ${K().beslutsnivaer[e.klass]?.vem || "ledningen"}. Kan testet göras mindre, så att det blir en hatt?`, "hjalp small varning") : null);
}

function experimentRedovisning() {
  const ov = kurs.ovningar.experiment;
  const lista = S.svar.generera.experiment;
  if (!lista.length) return p("Inga experimentkort att redovisa ännu.", "hjalp");
  return h("div", { class: "redovisning" }, lista.map((e) => {
    const sel = (namn, val, varde, satt) => {
      const el = h("select", { "data-fokus": `${namn}-${e.id}` }, val.map(([v, t]) => h("option", { value: v, selected: v === varde }, t)));
      el.addEventListener("change", () => { satt(el.value); andrat(); omrita(); });
      return h("label", { class: "falt-rad" }, h("span", { text: namn === "status" ? "Status" : "Sanningens ögonblick" }), el);
    };
    return h("article", { class: `card redovisningskort status-${e.status}` },
      h("h4", { text: e.titel }),
      p([e.ansvarig, e.stopp ? `stopp ${e.stopp}` : "", e.hypotes].filter(Boolean).join(" · "), "hjalp small"),
      h("div", { class: "exp-grid" },
        sel("status", ov.status, e.status, (v) => { e.status = v; }),
        sel("beslut", ov.beslut, e.beslut, (v) => { e.beslut = v; }),
        falt("Vad hände? Även det som inte fungerade.", e.resultat, (v) => { e.resultat = v; }, { rader: 3, fokus: `res-${e.id}` }),
        falt("Lärdom", e.lardom, (v) => { e.lardom = v; }, { rader: 3, fokus: `lar-${e.id}` })));
  }));
}

// ---------- Spelboken ----------

function vSpara() {
  const val = [
    ["las", "Länk låst med lösenfras", "Rekommenderas. Länken går bara att öppna med lösenfrasen, som ni delar på annat sätt."],
    ["data", "Länk utan lösenfras", "Den som har länken kan läsa innehållet. Länkar hamnar i historik, chattar och mejl."],
    ["ingen", "Ingen länk", "Filen läses in på startsidan när ni vill arbeta vidare."],
  ];
  const fras = h("input", { type: "password", autocomplete: "new-password", value: lankFras, "data-fokus": "fras", placeholder: `Minst ${M.MIN_FRAS} tecken` });
  fras.addEventListener("input", () => { lankFras = fras.value; });
  return h("section", { class: "card sparkort", id: "spara" },
    h("h2", { class: "kortrubrik", text: "Spara spelboken" }),
    p("Spelboken är en fil som öppnas i vilken webbläsare som helst och går att skriva ut som PDF. Under varje del finns en länk till den övning där ni arbetar vidare. Filen innehåller ledningens interna arbete och är märkt Intern.", "hjalp"),
    h("fieldset", { class: "plain" }, h("legend", { class: "small-legend", text: "Länken som öppnar kursen igen" }),
      h("div", { class: "lankval" }, val.map(([id, namn, text]) => h("label", { class: lankVal === id ? "lankalt vald" : "lankalt" },
        h("input", { type: "radio", name: "lankval", value: id, checked: lankVal === id, onchange: () => { lankVal = id; omrita(); }, "data-fokus": `lankval-${id}` }),
        h("span", {}, h("b", { text: namn }), h("span", { class: "hjalp small", text: text })))))),
    lankVal === "las" ? h("label", { class: "falt-rad frasfalt" }, h("span", { text: "Lösenfras" }), fras,
      h("span", { class: "hjalp small vikt", text: "Lösenfrasen sparas inte någonstans. Glöms den, läser ni in spelboksfilen i stället." })) : null,
    h("div", { class: "actions" },
      knapp("Spara spelboken", sparaSpelbok, "", { "data-fokus": "spara-spelbok" }),
      knapp("Öppna spelboken i ny flik", oppnaSpelbok, "ghost"),
      knapp("Läs in spelbok", valjFil, "ghost")));
}

function vSpelbok() {
  const s = S.svar;
  const bu = s.leda.budskap;
  const ma = s.leda.mandat;
  const ta = s.leda.takt;
  const ex = s.generera.experiment;
  const kort = M.allaBeslutskort(S);
  const klassade = kort.filter((k) => s.bedoma.placering.idag[k.id]).length;
  const delar = [
    ["Ledningens case", [s.fall.fraga, ...M.BLOCK.map((b) => s[b].fall)].filter(Boolean).length, null, "start/fall", "av fem: frågan och svaren i de fyra blocken"],
    ["Självskattning", M.BLOCK.reduce((n, b) => n + Object.keys(s[b].mal).length, 0), null, "leda/fall-tillbaka", "av tolv lärandemål skattade"],
    ["Våra spår", [s.leda.spar.framgang, s.leda.spar.laser, s.leda.spar.bryta].filter(Boolean).length, null, "leda/ov-spar", "av tre fält ifyllda"],
    ["Budskapet", [bu.varfor, bu.experiment, bu.misslyckat].filter(Boolean).length, 3, "leda/ov-budskap", "av tre svar skrivna"],
    ["Mandatet", ma.fritt.length + ma.fraga.length + ma.ledning.length, null, "leda/ov-mandat", "rader"],
    ["Takten", [ta.prova, ta.redovisa, ta.besluta, ta.matt, ta.nasta].filter(Boolean).length, 5, "leda/ov-takt", "av fem ifyllda"],
    ["Experiment", ex.length, null, "generera/ov-experiment", `kort, ${ex.filter((e) => e.status === "pagar" || e.status === "planerat").length} planerade eller pågående`],
    ["Beslut", S.beslut.length, null, "leda/besluta", "i loggen"],
    ["Klassade beslut", klassade, kort.length, "bedoma/ov-sortera", `av ${kort.length} beslutskort`],
    ["Idéer", s.generera.ideer.length, null, "generera/ov-ideer", "i flödet"],
    ["Det vi lärde oss", [s.forsta.redovisa.overraskade, s.forsta.redovisa.veta, s.forsta.f1.skillnad].filter(Boolean).length, null, "forsta/redovisa", "anteckningar"],
  ];
  return [
    ...rubrikrad("Det ni tar med er", "Ledningens spelbok", "Spelboken samlar det ni har gjort: budskap, mandat, takt, experiment, beslut och hur ni klassar besluten. Den är en fil som ni sparar, skriver ut och återkommer till."),
    vSpara(),
    vParallellt(),
    h("h2", { text: "Det här finns i spelboken nu" }),
    h("div", { class: "checklista" }, delar.map(([namn, n, av, vag, text]) => h("a", { class: n ? "check klar" : "check", href: `#${vag}` },
      h("span", { class: "check-ikon", "aria-hidden": "true", text: n ? "✓" : "○" }),
      h("b", { text: namn }),
      h("span", { text: av ? `${n} ${text}` : `${n} ${text}` })))),
    s.leda.redovisa.mandag ? h("section", { class: "card" }, h("h3", { text: "Det här säger vi på måndag" }), p(s.leda.redovisa.mandag)) : null,
    h("h2", { text: "Nästa steg" }),
    h("ul", { class: "lista-steg" },
      ta.nasta ? h("li", { text: `Nästa gång ni ses om det här: ${ta.nasta}.` }) : h("li", { text: "Bestäm när ni ses nästa gång, under Takten i Leda." }),
      ex.filter((e) => e.status === "planerat" || e.status === "pagar").map((e) => h("li", { text: `${e.titel}: ${e.ansvarig || "ansvarig saknas"}, stopp ${e.stopp || "saknas"}.` }))),
    rensaKnapp(),
  ];
}

// ---------- Så går det till ----------

function vGuide() {
  const g = kurs.guide;
  return [
    ...rubrikrad("Användarinstruktion", g.rubrik, g.ingress),
    h("h2", { text: "Processkarta" }),
    h("figure", { class: "karta" },
      h("div", { class: "zon" }, h("div", { class: "zon-namn", text: "Varje block, samma varv" }),
        h("ol", { class: "faser", "data-antal": "4" }, kurs.varv.map((v) => h("li", { class: "fas" }, h("span", { class: "fas-namn", text: v.namn }), h("span", { class: "fas-text", text: v.text }))))),
      h("p", { class: "overgang", text: "Fyra block, ett i taget" }),
      h("div", { class: "zon webblasare" }, h("div", { class: "zon-namn", text: "Kursen" }),
        h("ol", { class: "faser", "data-antal": "4" }, kurs.block.map((b) => h("li", { class: "fas" }, h("span", { class: "fas-namn", text: b.namn }), h("span", { class: "fas-text", text: b.fraga }))))),
      h("p", { class: "overgang", text: "Det ni gör samlas i" }),
      h("div", { class: "zon bakom" }, h("div", { class: "zon-namn", text: "Det ni tar med er" }),
        h("ol", { class: "faser", "data-antal": "3" },
          h("li", { class: "fas" }, h("span", { class: "fas-namn", text: "Spelboken" }), h("span", { class: "fas-text", text: "En fil att spara, skriva ut och dela" })),
          h("li", { class: "fas" }, h("span", { class: "fas-namn", text: "Länken" }), h("span", { class: "fas-text", text: "Öppnar kursen med allt ni har gjort" })),
          h("li", { class: "fas" }, h("span", { class: "fas-namn", text: "Nästa pass" }), h("span", { class: "fas-text", text: "Ni fortsätter där ni slutade" }))))),
    h("h2", { text: "Roller" }),
    h("div", { class: "roller" }, g.roller.map(([namn, text]) => h("div", { class: "card tight" }, h("h4", { text: namn }), p(text, "tight")))),
    h("h2", { text: "Steg för steg" }),
    h("ol", { class: "instr-steg" }, g.steg.map((s) => h("li", {}, h("h3", { text: s.rubrik }), p(s.text)))),
    h("h2", { text: "Kursplan" }),
    h("div", { class: "passlista" }, kurs.pass.map((ps) => h("section", { class: ps.id === "mellan" ? "card tight mellan" : "card tight" },
      h("h3", { text: ps.namn }), p(ps.form, "hjalp"),
      h("table", { class: "schema" }, h("tbody", {}, ps.delar.map(([tid, vad]) => h("tr", {}, h("td", { class: "tid", text: tid }), h("td", { text: vad })))))))),
    p(kurs.passKort, "note"),
    h("h2", { text: "Om informationen" }),
    h("ul", { class: "lista-steg" }, g.data.map((d) => h("li", { text: d }))),
    h("h2", { text: "Kursfilen" }),
    p("Kursfilen är det som gör kursen till en organisations egen: beskrivning, förslag på case, spelregler, beslutsnivåer, beslutskort, uppgifter och startvärden för kostnadsövningen. Kursledaren läser in den en gång, på datorn vid storskärmen; därefter följer innehållet med i spelboken och länken. Deltagarna behöver aldrig hantera den."),
    p("En ny kursfil görs i kursfilsverktyget: AI tar fram ett utkast ur organisationens egna dokument, och du granskar och laddar ner. Den som vill kan också ladda ner mallen och skriva filen för hand.", "hjalp"),
    h("div", { class: "actions" },
      h("a", { class: "btn", href: "#kursfil" }, "Öppna kursfilsverktyget"),
      h("a", { class: "btn ghost", href: "exempel/Exempel_kursfil.json", download: "Mall_kursfil.json" }, "Ladda ner mallen")),
  ];
}

// ---------- Arbeta parallellt: bidrag och sammanslagning ----------

let bidragNamn = "";
let senasteRapport = null;
const bidragsval = h("input", { type: "file", accept: ".json,.html,.htm,application/json,text/html", multiple: true, hidden: true });
document.body.append(bidragsval);
bidragsval.addEventListener("change", async () => {
  const filer = [...bidragsval.files];
  bidragsval.value = "";
  const rapporter = [];
  const fel = [];
  for (const fil of filer) {
    try {
      if (fil.size > MAX_FIL) throw new Error("storlek");
      const r = M.lasFil(await fil.text());
      if (r.typ !== "spelbok") throw new Error("typ");
      const av = r.S.meta.av || fil.name.replace(/^Bidrag_/, "").replace(/_\d{4}-\d{2}-\d{2}.*$/, "").replace(/_/g, " ").slice(0, 80);
      const { S: ny, rapport } = M.slaIhop(S, r.S, av);
      S = ny;
      rapporter.push(rapport);
    } catch (err) {
      fel.push(`${fil.name}: ${err?.message === "organisation" ? "gäller en annan organisation" : "gick inte att läsa"}`);
    }
  }
  senasteRapport = { rapporter, fel };
  if (rapporter.length) andrat(true);
  flash(rapporter.length ? `${rapporter.length} bidrag är ihopslagna.` : "Inga bidrag kunde slås ihop.", !rapporter.length);
  render.hoppa = true;
  if (location.hash === "#spelbok/parallellt") render(); else location.hash = "#spelbok/parallellt";
});

function sparaBidrag() {
  const namn = bidragNamn.trim();
  if (!namn) { flash("Skriv ditt namn först, så att kursledaren ser vems bidraget är.", true); document.querySelector('[data-fokus="bidrag-namn"]')?.focus(); return; }
  const data = M.sparbart(S);
  data.meta = { ...data.meta, av: namn.slice(0, 80) };
  laddaNer(`Bidrag_${slug(namn)}_${M.idag()}.json`, JSON.stringify(data), "application/json");
  flash("Ditt bidrag är sparat. Lämna filen till kursledaren.");
}

const VAL_NAMN = { hatt: "Hatt", frisyr: "Frisyr", tatuering: "Tatuering", ai: "AI", auto: "Automation", manniska: "Människa" };

function vRapport() {
  if (!senasteRapport) return null;
  const { rapporter, fel } = senasteRapport;
  const oenighet = rapporter.flatMap((r) => r.oenighet.map((o) => ({ ...o, av: r.av })));
  const textOenighet = () => oenighet.filter((o) => o.typ === "beslut").map((o) => `${o.text}: vi ${VAL_NAMN[o.vi].toLowerCase()}, ${o.av || "ett bidrag"} ${VAL_NAMN[o.de].toLowerCase()}`).join("\n");
  return h("div", { class: "card tight rapport", role: "status" },
    h("h4", { text: "Sammanslagningen" }),
    rapporter.length ? h("ul", { class: "lista-steg" }, rapporter.map((r) => h("li", {},
      h("b", { text: r.av || "Bidrag" }), ": ",
      [
        r.ideer && `${r.ideer} idéer`, r.experiment && `${r.experiment} experimentkort`, r.uppdateradeExperiment && `${r.uppdateradeExperiment} uppdaterade experiment`,
        r.beslut && `${r.beslut} beslut`, r.kort && `${r.kort} egna beslutskort`, r.placeringar && `${r.placeringar} klassningar`, r.texter && `${r.texter} texter`,
      ].filter(Boolean).join(", ") || "inget nytt"))) : null,
    oenighet.length ? h("div", {},
      h("h4", { text: "Här var ni oense" }),
      h("ul", { class: "lista-steg" }, oenighet.map((o) => h("li", {}, `${o.text}: `, h("b", { text: `${VAL_NAMN[o.vi]}` }), ` här, `, h("b", { text: VAL_NAMN[o.de] }), ` hos ${o.av || "ett bidrag"}`))),
      oenighet.some((o) => o.typ === "beslut") ? knapp("Lägg oenigheten om besluten under Var var vi oense? i Bedöma", () => {
        const r = S.svar.bedoma.redovisa;
        r.oense = M.slaIhopText(r.oense, textOenighet(), "");
        andrat(true);
        flash("Oenigheten ligger nu under Redovisa i Bedöma.");
      }, "ghost liten-knapp", { "data-fokus": "oenighet-till-bedoma" }) : null) : null,
    fel.length ? h("p", { class: "varning" }, fel.join(". ")) : null);
}

function vParallellt() {
  const t = kurs.parallellt;
  const namn = h("input", { type: "text", maxlength: 80, value: bidragNamn, placeholder: "Ditt namn", "data-fokus": "bidrag-namn", list: "deltagarlista" });
  namn.addEventListener("input", () => { bidragNamn = namn.value; });
  ansvarigFalt("tom");
  return h("section", { class: "card parallellt", id: "parallellt" },
    h("h2", { class: "kortrubrik", text: t.rubrik }),
    p(t.text, "hjalp"),
    h("div", { class: "tvaspalt" },
      h("div", { class: "del" },
        h("h3", { text: "Deltagare på egen dator" }),
        h("ol", { class: "lista-steg" }, t.deltagare.map((x) => h("li", { text: x }))),
        h("div", { class: "egen-rad" }, namn, knapp("Spara mitt bidrag", sparaBidrag, "", { "data-fokus": "spara-bidrag" }))),
      h("div", { class: "del" },
        h("h3", { text: "Kursledaren" }),
        h("ol", { class: "lista-steg" }, t.kursledare.map((x) => h("li", { text: x }))),
        knapp("Slå ihop bidrag", () => bidragsval.click(), "", { "data-fokus": "sla-ihop" }))),
    vRapport());
}

// ---------- Kursfilsverktyget ----------

const UTKAST_NYCKEL = "leda-i-ai-takt-kursfil";
let utkast = null; // { k: kursfil, saknas: [] }
let exempelText = "";

function sparaUtkast() { try { sessionStorage.setItem(UTKAST_NYCKEL, JSON.stringify(utkast)); } catch { /* bara i minnet */ } }
function lasUtkast() {
  try {
    const d = JSON.parse(sessionStorage.getItem(UTKAST_NYCKEL) || "null");
    if (d && d.k) utkast = { k: M.lasKursfil({ ...d.k, format: M.FORMAT_KURSFIL }), saknas: Array.isArray(d.saknas) ? d.saknas.map((x) => M.txt(x)).slice(0, 30) : [] };
  } catch { utkast = null; }
}
let utkastTimer = null;
function utkastAndrat(omritaNu = false) {
  clearTimeout(utkastTimer);
  utkastTimer = setTimeout(() => { sparaUtkast(); visaVarningar(); }, 250);
  if (omritaNu) { sparaUtkast(); omrita(); }
}
async function hamtaExempel() {
  if (exempelText) return exempelText;
  try { exempelText = await (await fetch("exempel/Exempel_kursfil.json")).text(); } catch { exempelText = ""; }
  return exempelText;
}

const kursfilval = h("input", { type: "file", accept: ".json,application/json", hidden: true });
document.body.append(kursfilval);
kursfilval.addEventListener("change", async () => {
  const fil = kursfilval.files[0];
  kursfilval.value = "";
  if (!fil) return;
  try {
    if (fil.size > MAX_FIL) throw new Error("storlek");
    const r = M.lasFil(await fil.text());
    if (r.typ !== "kursfil") throw new Error("typ");
    utkast = { k: r.kursfil, saknas: [] };
    utkastAndrat(true);
    flash(`Kursfilen för ${r.kursfil.organisation} är öppnad i verktyget.`);
  } catch {
    flash("Filen gick inte att läsa som kursfil.", true);
  }
});

function borja(fran) {
  if (fran === "mall") {
    hamtaExempel().then((t) => {
      const k = t ? M.lasKursfil(t) : M.tomKursfil();
      k.organisation = "Ny organisation";
      utkast = { k, saknas: [] };
      utkastAndrat(true);
    });
  } else if (fran === "tom") {
    utkast = { k: M.tomKursfil(), saknas: [] };
    utkastAndrat(true);
  } else if (fran === "nu") {
    utkast = { k: JSON.parse(JSON.stringify(K())), saknas: [] };
    utkastAndrat(true);
  } else kursfilval.click();
}

function visaVarningar() {
  const ruta = document.getElementById("kf-varningar");
  if (!ruta || !utkast) return;
  const v = M.kursfilVarningar(utkast.k);
  fyll(ruta,
    h("h3", { text: "Kvalitetskontroll" }),
    v.length ? h("ul", { class: "varningslista" }, v.map((x) => h("li", { text: x }))) : h("p", { class: "klar-text", text: "Inget att anmärka. Pröva kursfilen i kursen innan den används." }),
    utkast.saknas.length ? h("div", {}, h("h4", { text: "AI:s lista över det som saknas i underlaget" }), h("ul", { class: "varningslista saknas" }, utkast.saknas.map((x) => h("li", { text: x })))) : null,
    M.tankstreckIKursfil(utkast.k) ? knapp("Byt tankstreck mot komma", () => { utkast.k = M.bytTankstreck(utkast.k); utkastAndrat(true); }, "ghost liten-knapp", { "data-fokus": "byt-tankstreck" }) : null);
}

// Små redigerare. De ändrar utkastet direkt och ritar bara om när listor ändras.
function kfText(etikett, objekt, nyckel, { area = false, max = 600, platshallare = "", fokus = "" } = {}) {
  return falt(etikett, objekt[nyckel], (v) => { objekt[nyckel] = v.slice(0, max); utkastAndrat(); }, { typ: area ? "area" : "text", rader: 2, max, platshallare, fokus });
}
function kfSelect(etikett, objekt, nyckel, val, fokus) {
  const el = h("select", { "data-fokus": fokus }, h("option", { value: "" }, "Välj"), val.map(([v, t]) => h("option", { value: v, selected: objekt[nyckel] === v }, t)));
  el.addEventListener("change", () => { objekt[nyckel] = el.value; utkastAndrat(); });
  return h("label", { class: "falt-rad" }, h("span", { text: etikett }), el);
}
function kfLista(namn, lista, ny, rita, maxAntal) {
  return h("div", { class: "kf-lista" },
    lista.map((x, i) => h("div", { class: "kf-rad" },
      h("div", { class: "kf-falt" }, rita(x, i)),
      h("div", { class: "kf-knappar" },
        i > 0 ? knapp("Upp", () => { [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; utkastAndrat(true); }, "lank-knapp") : null,
        knapp("Ta bort", () => { lista.splice(i, 1); utkastAndrat(true); }, "lank-knapp")))),
    lista.length < maxAntal ? knapp(`Lägg till ${namn}`, () => { lista.push(ny()); utkastAndrat(true); }, "ghost liten-knapp", { "data-fokus": `kf-ny-${namn}` }) : null);
}

function vKursfil() {
  const t = kurs.kursfilverktyg;
  if (!utkast) lasUtkast();
  const head = [
    ...rubrikrad("För kursledaren", t.rubrik, t.ingress),
    h("ol", { class: "varv kf-steg" }, t.steg.map(([namn, text]) => h("li", {}, h("div", {}, h("b", { text: namn }), h("span", { text })))))];
  const borjaRad = h("div", { class: "actions" },
    knapp("Börja från mallen", () => borja("mall"), utkast ? "ghost" : "", { "data-fokus": "kf-mall" }),
    knapp("Öppna en kursfil", () => borja("fil"), "ghost"),
    knapp("Utgå från kursen som används nu", () => borja("nu"), "ghost"),
    utkast ? knapp("Börja om med tom fil", () => borja("tom"), "lank-knapp") : null);
  if (!utkast) return [...head, h("h2", { text: "1. Börja" }), borjaRad];

  const k = utkast.k;
  const bn = k.beslutsnivaer;
  const sr = k.spelregler;
  const svarTxt = h("textarea", { rows: 6, placeholder: "Klistra in hela svaret från AI här", "data-fokus": "kf-ai-svar" });
  const lasSvar = () => {
    try {
      const r = M.tolkaAiSvar(svarTxt.value);
      utkast = { k: r.kursfil, saknas: r.saknas };
      utkastAndrat(true);
      flash("Utkastet är inläst. Granska varje del nedan.");
    } catch {
      flash("Svaret gick inte att läsa som JSON. Be AI svara med enbart JSON och försök igen.", true);
    }
  };
  const promptText = kurs.kursfilverktyg.prompt.replace("{organisation}", k.organisation && k.organisation !== "Ny organisation" ? k.organisation : "organisationen")
    .replace("{struktur}", exempelText || "(mallen kunde inte hämtas; ladda ner den från Så går det till)");
  if (!exempelText) hamtaExempel().then(() => { if (rutt().vy === "kursfil") omrita(); });

  const anvand = () => {
    try {
      const ny = M.lasKursfil(M.kursfilTillJson(k));
      S = harArbete() && ny.organisation === K().organisation ? M.lasTillstand({ ...M.sparbart(S), kursfil: ny }) : M.nyttTillstand(ny);
      andrat(true);
      flash(`Kursen använder nu kursfilen för ${ny.organisation}.`);
      render.hoppa = true;
      location.hash = "#start";
    } catch { flash("Kursfilen gick inte att använda.", true); }
  };

  return [
    ...head,
    h("h2", { text: "1. Börja" }), borjaRad,

    h("h2", { text: "2. Låt AI göra ett utkast" }),
    h("p", { class: "note strong", text: t.varning }),
    (() => {
      const f = kfText("Organisationens namn", k, "organisation", { max: 160, fokus: "kf-org" });
      f.querySelector("input").addEventListener("change", () => utkastAndrat(true));
      return f;
    })(),
    promptruta(promptText),
    h("label", { class: "falt-rad" }, h("span", { text: "AI:s svar" }), svarTxt),
    h("div", { class: "actions tight-actions" }, knapp("Läs in utkastet", lasSvar, "", { "data-fokus": "kf-las-svar" })),

    h("h2", { text: "3. Granska och ändra" }),
    h("div", { class: "kf-layout" },
      h("div", { class: "kf-form" },
        h("section", { class: "card" }, h("h3", { text: "Organisationen" }),
          kfText("Gruppens namn", k, "grupp", { max: 160, fokus: "kf-grupp" }),
          kfText("Beskrivning, så att den passar efter orden \"ledningsgruppen i\"", k, "beskrivning", { platshallare: "ett svenskt konsultbolag inom ...", fokus: "kf-beskr" }),
          h("h4", { text: "Förslag på ledningens case" }),
          kfLista("case", k.caseforslag, () => "", (x, i) => {
            const el = h("input", { type: "text", maxlength: 600, value: x, "data-fokus": `kf-case-${i}` });
            el.addEventListener("input", () => { k.caseforslag[i] = el.value; utkastAndrat(); });
            return el;
          }, 8)),
        h("section", { class: "card" }, h("h3", { text: "Sammanhang" }), p("Strategi och årets fokus, två till fyra korta stycken.", "hjalp small"),
          kfLista("stycke", k.sammanhang, () => ({ rubrik: "", text: "" }), (x, i) => [kfText("Rubrik", x, "rubrik", { max: 160, fokus: `kf-sh-r-${i}` }), kfText("Text", x, "text", { area: true, max: 3000, fokus: `kf-sh-t-${i}` })], 6)),
        h("section", { class: "card" }, h("h3", { text: "Spelregler" }),
          kfText("Källa", sr, "kalla", { platshallare: "Till exempel: AI-policy v1.0 och AI-instruktion v1.0", fokus: "kf-sr-kalla" }),
          h("h4", { text: "Principer" }),
          kfLista("princip", sr.principer, () => ({ rubrik: "", text: "" }), (x, i) => [kfText("Rubrik", x, "rubrik", { max: 160, fokus: `kf-pr-r-${i}` }), kfText("Text", x, "text", { area: true, fokus: `kf-pr-t-${i}` })], 12),
          h("h4", { text: "Regler i vardagen" }),
          kfLista("regel", sr.regler, () => "", (x, i) => {
            const el = h("input", { type: "text", maxlength: 600, value: x, "data-fokus": `kf-re-${i}` });
            el.addEventListener("input", () => { sr.regler[i] = el.value; utkastAndrat(); });
            return el;
          }, 16)),
        h("section", { class: "card" }, h("h3", { text: "Beslutsnivåer" }),
          kfText("Källa", bn, "kalla", { fokus: "kf-bn-kalla" }),
          [["ide", "Idé"], ["hatt", "Hatt"], ["frisyr", "Frisyr"], ["tatuering", "Tatuering"]].map(([id, namn]) => h("div", { class: `kf-niva niva ${id}` },
            h("b", { text: namn }),
            kfText("Vem beslutar", bn[id], "vem", { max: 160, fokus: `kf-bn-${id}-vem` }),
            kfText("Vad", bn[id], "text", { fokus: `kf-bn-${id}-text` }),
            id === "hatt" ? kfText("Mandat", bn[id], "grans", { max: 160, platshallare: "Till exempel: upp till 50 000 kr per år", fokus: `kf-bn-${id}-grans` }) : null))),
        h("section", { class: "card" }, h("h3", { text: "Beslutskort" }), p("Beslut som organisationen står inför. Alla tre klasserna bör finnas med.", "hjalp small"),
          kfLista("beslut", k.beslutskort, () => ({ id: "", text: "", forslag: "", motivering: "" }), (x, i) => [
            kfText("Beslut", x, "text", { max: 160, fokus: `kf-bk-t-${i}` }),
            kfSelect("Kursledarens förslag", x, "forslag", kurs.klasser.map((c) => [c.id, c.namn]), `kf-bk-f-${i}`),
            kfText("Motivering", x, "motivering", { fokus: `kf-bk-m-${i}` })], 40)),
        h("section", { class: "card" }, h("h3", { text: "Uppgiftskort" }), p("Uppgifter ur organisationens vardag. Alla tre svaren bör finnas med.", "hjalp small"),
          kfLista("uppgift", k.uppgiftskort, () => ({ id: "", text: "", svar: "", motivering: "" }), (x, i) => [
            kfText("Uppgift", x, "text", { max: 160, fokus: `kf-uk-t-${i}` }),
            kfSelect("Svar", x, "svar", kurs.uppgiftsval.map((c) => [c.id, c.namn]), `kf-uk-s-${i}`),
            kfText("Motivering", x, "motivering", { fokus: `kf-uk-m-${i}` })], 40)),
        h("section", { class: "card" }, h("h3", { text: "Startvärden för kostnadsövningen" }),
          h("div", { class: "kalkyl-in" }, kurs.ovningar.kostnad.falt.map((f) => {
            const el = h("input", { type: "number", min: f.min, max: f.max, step: f.steg, value: k.kostnad[f.id], "data-fokus": `kf-ko-${f.id}` });
            el.addEventListener("input", () => { const n = Number(el.value); if (el.value !== "" && Number.isFinite(n)) { k.kostnad[f.id] = n; utkastAndrat(); } });
            return h("label", { class: "falt-rad" }, h("span", { text: f.namn }), el);
          })))),
      h("aside", { class: "kf-sida" }, h("div", { class: "card kf-varningar", id: "kf-varningar" }))),

    h("h2", { text: "4. Ladda ner och pröva" }),
    h("div", { class: "actions" },
      knapp("Ladda ner kursfilen", () => {
        laddaNer(`Kursfil_${slug(k.organisation)}.json`, `${JSON.stringify(M.kursfilTillJson(k), null, 2)}\n`, "application/json");
        flash("Kursfilen är nedladdad. Lägg den aldrig i ett publikt repo.");
      }, "", { "data-fokus": "kf-ladda-ner" }),
      knapp("Pröva den i kursen nu", anvand, "ghost", { "data-fokus": "kf-anvand" })),
    p("Pröva byter kursfil i den här fliken. Gäller den en annan organisation börjar kursen om från början, så att inget arbete blandas ihop. Spara spelboken först om ni vill behålla det ni gjort.", "hjalp small"),
  ];
}

// ---------- Presentationsläget ----------

const presRuta = h("div", { class: "pres", id: "pres", hidden: true, role: "dialog", "aria-modal": "true", "aria-label": "Presentation" });
document.body.append(presRuta);

// Presentationen visar först blockets grunder och sedan gissningskorten, i en följd.
function presLista(b) {
  return [...(b.grund || []).map((g) => ({ typ: "grund", g })), ...b.lara.map((k) => ({ typ: "kort", k }))];
}
function oppnaPres(blockId, i) {
  const lista = presLista(blockAv(blockId));
  pres = { block: blockId, i, visat: lista[i]?.typ === "grund" };
  presRuta.hidden = false;
  document.body.classList.add("presenterar");
  ritaPres();
}
function stangPres() {
  if (!pres) return;
  const post = presLista(blockAv(pres.block))[pres.i];
  pres = null;
  presRuta.hidden = true;
  document.body.classList.remove("presenterar");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  render();
  const el = post && document.getElementById(post.typ === "kort" ? `kort-${post.k.id}` : "grunderna");
  if (el) el.scrollIntoView({ block: "center" });
}
function presFram() {
  const b = blockAv(pres.block);
  const lista = presLista(b);
  const post = lista[pres.i];
  if (!pres.visat) { pres.visat = true; visade.add(`${b.id}-${post.k.id}`); }
  else if (pres.i < lista.length - 1) { pres.i += 1; pres.visat = lista[pres.i].typ === "grund"; }
  else { stangPres(); return; }
  ritaPres();
}
function presBak() {
  const lista = presLista(blockAv(pres.block));
  if (pres.visat && lista[pres.i].typ === "kort") pres.visat = false;
  else if (pres.i > 0) { pres.i -= 1; pres.visat = true; }
  ritaPres();
}
function ritaPres() {
  const b = blockAv(pres.block);
  const lista = presLista(b);
  const post = lista[pres.i];
  const sista = pres.i === lista.length - 1;
  const antalGrund = (b.grund || []).length;
  const del = post.typ === "grund" ? `Grunderna ${pres.i + 1} av ${antalGrund}` : `Gissa och resonera ${pres.i - antalGrund + 1} av ${b.lara.length}`;
  const kropp = post.typ === "grund"
    ? [h("div", { class: "eyebrow", text: `${b.namn}: grunderna` }),
      h("h2", { class: "pres-fraga", text: post.g.rubrik }),
      h("ul", { class: "pres-punkter" }, post.g.punkter.map((t) => h("li", { text: t }))),
      post.g.kalla ? p(`Källa: ${post.g.kalla}`, "hjalp pres-kalla") : null]
    : [h("div", { class: "eyebrow", text: post.k.rubrik }),
      h("p", { class: "pres-fraga", text: post.k.gissa }),
      pres.visat ? h("div", { class: "pres-svar" }, kunskapskortInnehall(post.k)) : h("p", { class: "pres-tips", text: "Gissa först. Mellanslag eller pil höger visar svaret." })];
  fyll(presRuta,
    h("div", { class: "pres-topp" },
      h("span", { text: `${b.namn} · ${del}` }),
      h("div", { class: "pres-verktyg" },
        document.fullscreenEnabled ? knapp(document.fullscreenElement ? "Lämna helskärm" : "Helskärm", () => {
          (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}).finally(() => setTimeout(ritaPres, 100));
        }, "pres-knapp") : null,
        knapp("Stäng", stangPres, "pres-knapp", { "aria-label": "Stäng presentationen" }))),
    h("div", { class: "pres-kropp" }, kropp),
    h("div", { class: "pres-fot" },
      knapp("Föregående", presBak, "pres-knapp", { disabled: pres.i === 0 && (post.typ === "grund" || !pres.visat) }),
      h("div", { class: "pres-prickar" }, lista.map((x, j) => h("i", { class: [x.typ === "grund" ? "g" : "", j === pres.i ? "nu" : j < pres.i ? "klar" : ""].filter(Boolean).join(" ") }))),
      knapp(!pres.visat ? "Visa svaret" : sista ? "Avsluta" : post.typ === "grund" && lista[pres.i + 1]?.typ === "kort" ? "Till gissningarna" : "Nästa", presFram, "pres-knapp fram")));
  presRuta.querySelector(".fram")?.focus({ preventScroll: true });
  presRuta.scrollTop = 0;
}
document.addEventListener("keydown", (e) => {
  if (!pres) return;
  if (e.key === "Escape") { e.preventDefault(); stangPres(); }
  else if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && e.target.tagName !== "BUTTON")) { e.preventDefault(); presFram(); }
  else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); presBak(); }
});

// ---------- Länken från spelboken ----------

async function lasLank() {
  const del = location.hash.slice(1);
  const par = new URLSearchParams(del);
  const kod = par.get("data") || "";
  const till = (par.get("till") || "spelbok").replace(/[^a-z0-9/-]/gi, "");
  history.replaceState(null, "", `${location.pathname}${location.search}#${till}`);
  if (par.get("las")) {
    if (!S && !aterstall()) await startaNy();
    lasKod = par.get("las");
    lasTill = till;
    render();
    return;
  }
  try {
    S = await M.packaUpp(kod);
    osparat = false;
    spara();
    flash("Spelboken är öppnad. Ni fortsätter där ni slutade.");
  } catch (err) {
    console.warn("Länken kunde inte packas upp:", err?.message);
    if (!S) await startaNy();
    flash("Länken gick inte att öppna. Läs in spelboksfilen i stället.", true);
  }
  render.hoppa = true;
  render();
}

function vLas() {
  const fras = h("input", { type: "password", autocomplete: "off", "data-fokus": "oppna-fras", placeholder: "Lösenfras" });
  const fel = p("", "varning");
  const oppna = async () => {
    knappEl.disabled = true;
    try {
      S = await M.packaUppLast(lasKod, fras.value);
      lasKod = null;
      osparat = false;
      spara();
      flash("Spelboken är öppnad. Ni fortsätter där ni slutade.");
      render.hoppa = true;
      if (rutt().vy + (rutt().ankare ? `/${rutt().ankare}` : "") === lasTill) render(); else location.hash = `#${lasTill}`;
    } catch (err) {
      fel.textContent = err?.message === "fras" ? "Fel lösenfras, eller en skadad länk. Försök igen." : "Länken gick inte att öppna. Läs in spelboksfilen i stället.";
      knappEl.disabled = false;
      fras.select();
    }
  };
  const knappEl = knapp("Öppna", oppna, "", { "data-fokus": "oppna-las" });
  fras.addEventListener("keydown", (e) => { if (e.key === "Enter") oppna(); });
  setTimeout(() => fras.focus(), 0);
  return [
    ...rubrikrad("Låst spelbok", "Ange lösenfrasen", "Länken är låst. Lösenfrasen finns inte i länken och skickas ingenstans; spelboken låses upp här i webbläsaren."),
    h("section", { class: "card smal" },
      h("label", { class: "falt-rad" }, h("span", { text: "Lösenfras" }), fras),
      fel,
      h("div", { class: "actions" }, knappEl, knapp("Avbryt", () => { lasKod = null; render(); }, "ghost"))),
  ];
}

async function startaNy() {
  try {
    const svar = await fetch("exempel/Exempel_kursfil.json");
    S = M.nyttTillstand(M.lasKursfil(await svar.text()));
  } catch (err) {
    console.error(err);
    S = M.nyttTillstand(M.lasKursfil({ format: M.FORMAT_KURSFIL, organisation: "Exempel" }));
  }
}

// ---------- Start ----------

async function init() {
  lasUi();
  document.body.classList.toggle("stor", ui.stor);
  if (/^#(data|las)=/.test(location.hash)) { await lasLank(); return; }
  if (!aterstall()) await startaNy();
  render.hoppa = true;
  render();
}
init();
