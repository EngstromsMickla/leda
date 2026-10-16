// Leda i AI-takt: tillstånd, regler, kursfil, sparfil, spelbok och fortsätt-länk.
// Inga DOM-anrop här, så att allt kan testas i Node.

export const FORMAT_KURSFIL = "mickla-leda-kursfil";
export const FORMAT_SPELBOK = "mickla-leda-spelbok";
export const KLASSER = ["hatt", "frisyr", "tatuering"];
export const UPPGIFTSVAL = ["ai", "auto", "manniska"];
export const LAGEN = ["idag", "billigt", "last"];
export const ZONER = ["explore", "grind", "exploit"];
export const BLOCK = ["forsta", "bedoma", "generera", "leda"];
export const STATUS = ["planerat", "pagar", "lyckat", "misslyckat", "stoppat"];
export const EXPBESLUT = ["", "anta", "justera", "stoppa"];
export const KOSTNADSFALT = ["anvandare", "fragor", "perFraga", "dagar", "licens", "agentUppgifter", "agentSteg", "agentPerSteg"];
export const SJALV = ["ja", "delvis", "nej"];
export const NYTTA = ["mycket", "ganska", "lite", "inte"];

const MAX = { kort: 160, mellan: 600, lang: 3000 };

// ---------- Försiktig läsning ----------

export function txt(v, max = MAX.mellan) {
  if (typeof v !== "string") return "";
  // Bort med styrtecken utom radbrytning och tabb.
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
}
const ett = (v, tillatna, standard = "") => (tillatna.includes(v) ? v : standard);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
export const giltigtId = (v) => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(v);
const datum = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
function tal(v, min, max, standard) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return standard;
  return Math.min(max, Math.max(min, n));
}

// ---------- Kursfilen ----------

export function lasKursfil(indata) {
  const d = typeof indata === "string" ? JSON.parse(indata) : indata;
  if (!d || d.format !== FORMAT_KURSFIL) throw new Error("format");
  const nivå = (n) => ({ vem: txt(obj(n).vem, MAX.kort), text: txt(obj(n).text, MAX.mellan), grans: txt(obj(n).grans, MAX.kort) });
  const bn = obj(d.beslutsnivaer);
  const sr = obj(d.spelregler);
  const k = obj(d.kostnad);
  const unika = (lista) => {
    const sett = new Set();
    return lista.filter((x) => giltigtId(x.id) && x.text && !sett.has(x.id) && sett.add(x.id));
  };
  return {
    format: FORMAT_KURSFIL,
    version: 1,
    organisation: txt(d.organisation, MAX.kort) || "Okänd organisation",
    grupp: txt(d.grupp, MAX.kort),
    beskrivning: txt(d.beskrivning, MAX.mellan),
    caseforslag: arr(d.caseforslag, 8).map((c) => txt(c, MAX.mellan)).filter(Boolean),
    sammanhang: arr(d.sammanhang, 6).map((s) => ({ rubrik: txt(obj(s).rubrik, MAX.kort), text: txt(obj(s).text, MAX.lang) })).filter((s) => s.rubrik || s.text),
    spelregler: {
      kalla: txt(sr.kalla, MAX.mellan),
      principer: arr(sr.principer, 12).map((p) => ({ rubrik: txt(obj(p).rubrik, MAX.kort), text: txt(obj(p).text, MAX.mellan) })).filter((p) => p.rubrik || p.text),
      regler: arr(sr.regler, 16).map((r) => txt(r, MAX.mellan)).filter(Boolean),
    },
    beslutsnivaer: {
      kalla: txt(bn.kalla, MAX.mellan),
      ide: nivå(bn.ide), hatt: nivå(bn.hatt), frisyr: nivå(bn.frisyr), tatuering: nivå(bn.tatuering),
    },
    beslutskort: unika(arr(d.beslutskort, 40).map((b) => ({
      id: obj(b).id, text: txt(obj(b).text, MAX.kort), forslag: ett(obj(b).forslag, KLASSER), motivering: txt(obj(b).motivering, MAX.mellan),
    }))),
    uppgiftskort: unika(arr(d.uppgiftskort, 40).map((u) => ({
      id: obj(u).id, text: txt(obj(u).text, MAX.kort), svar: ett(obj(u).svar, UPPGIFTSVAL), motivering: txt(obj(u).motivering, MAX.mellan),
    }))),
    kostnad: kostnadsvarden(k),
  };
}

export function kostnadsvarden(k = {}) {
  const s = { anvandare: 40, fragor: 20, perFraga: 0.2, dagar: 220, licens: 250, agentUppgifter: 100, agentSteg: 50, agentPerSteg: 1 };
  const g = { anvandare: [1, 100000], fragor: [0, 10000], perFraga: [0, 1000], dagar: [1, 366], licens: [0, 100000], agentUppgifter: [0, 1000000], agentSteg: [0, 100000], agentPerSteg: [0, 10000] };
  const ut = {};
  for (const f of KOSTNADSFALT) ut[f] = tal(obj(k)[f], g[f][0], g[f][1], s[f]);
  return ut;
}

// ---------- Tillståndet ----------

export function nyttSvar() {
  return {
    fall: { fraga: "", varfor: "", kunna: "" },
    utvardering: { basta: "", andra: "", saknas: "", nytta: "", nyttor: [] },
    forsta: { f1: { skillnad: "", tal: "" }, uppgifter: {}, kommentar: {}, kostnad: null, redovisa: { overraskade: "", veta: "" }, fall: "", mal: {} },
    bedoma: { guide: { titel: "", svar: {} }, placering: { idag: {}, billigt: {}, last: {} }, egnaKort: [], redovisa: { oense: "" }, fall: "", mal: {} },
    generera: { prompter: {}, ideer: [], experiment: [], redovisa: {}, fall: "", mal: {}, mandatTimmar: "" },
    leda: {
      spar: { framgang: "", laser: "", bryta: "" },
      bygga: { gemensamt: "", fritt: "", synligt: "" },
      budskap: { varfor: "", experiment: "", misslyckat: "" },
      mandat: { fritt: [], fraga: [], ledning: [] },
      takt: { prova: "", redovisa: "", besluta: "", matt: "", nasta: "" },
      karta: {}, flytt: {}, redovisa: { mandag: "" }, fall: "", mal: {},
    },
  };
}

export function nyttTillstand(kursfil) {
  return {
    meta: { grupp: kursfil?.grupp || "", deltagare: [], skapad: idag() },
    kursfil,
    svar: nyttSvar(),
    beslut: [],
  };
}

export function idag() { return new Date().toISOString().slice(0, 10); }

let raknare = 0;
export function nyttId(prefix) {
  raknare += 1;
  return `${prefix}-${Date.now().toString(36)}${raknare.toString(36)}`.slice(0, 40);
}

// Läser ett sparat tillstånd (från spelbok, sparfil, länk eller fliken) och behåller bara kända fält.
export function lasTillstand(indata) {
  const d = typeof indata === "string" ? JSON.parse(indata) : indata;
  if (!d || d.format !== FORMAT_SPELBOK) throw new Error("format");
  const kursfil = lasKursfil(d.kursfil);
  const S = nyttTillstand(kursfil);
  const m = obj(d.meta);
  S.meta = { grupp: txt(m.grupp, MAX.kort), deltagare: arr(m.deltagare, 30).map((x) => txt(x, 80)).filter(Boolean), skapad: datum(m.skapad) || idag() };
  if (txt(m.av, 80)) S.meta.av = txt(m.av, 80);
  const s = obj(d.svar);
  const fa = obj(s.fall);
  S.svar.fall = { fraga: txt(fa.fraga, MAX.mellan), varfor: txt(fa.varfor, MAX.lang), kunna: txt(fa.kunna, MAX.lang) };
  for (const b of BLOCK) {
    const bl = obj(s[b]);
    S.svar[b].fall = txt(bl.fall, MAX.lang);
    for (const [i, v] of Object.entries(obj(bl.mal))) if (/^[0-9]$/.test(i) && SJALV.includes(v)) S.svar[b].mal[i] = v;
  }

  const ut = obj(s.utvardering);
  S.svar.utvardering = {
    basta: txt(ut.basta, MAX.lang), andra: txt(ut.andra, MAX.lang), saknas: txt(ut.saknas, MAX.lang),
    nytta: ett(ut.nytta, NYTTA), nyttor: arr(ut.nyttor, 60).filter((v) => NYTTA.includes(v)),
  };
  const mt = obj(s.generera).mandatTimmar;
  S.svar.generera.mandatTimmar = mt === "" || mt === undefined || mt === null ? "" : tal(mt, 1, 100, "");

  const f = obj(s.forsta);
  S.svar.forsta.f1 = { skillnad: txt(obj(f.f1).skillnad, MAX.lang), tal: txt(obj(f.f1).tal, MAX.lang) };
  const uppgiftsId = new Set(kursfil.uppgiftskort.map((u) => u.id));
  for (const [id, v] of Object.entries(obj(f.uppgifter))) if (uppgiftsId.has(id) && UPPGIFTSVAL.includes(v)) S.svar.forsta.uppgifter[id] = v;
  for (const [id, v] of Object.entries(obj(f.kommentar))) if (uppgiftsId.has(id)) S.svar.forsta.kommentar[id] = txt(v, MAX.mellan);
  S.svar.forsta.kostnad = f.kostnad ? kostnadsvarden(f.kostnad) : null;
  S.svar.forsta.redovisa = { overraskade: txt(obj(f.redovisa).overraskade, MAX.lang), veta: txt(obj(f.redovisa).veta, MAX.lang) };

  const b = obj(s.bedoma);
  const g = obj(b.guide);
  S.svar.bedoma.guide = { titel: txt(g.titel, MAX.kort), svar: {} };
  const tillatnaGuide = { angra: ["ja", "nej"], info: ["oppen", "intern", "kund"], beroende: ["ja", "nej"], kostnad: ["ja", "nej"], karna: ["ja", "nej"] };
  for (const [q, val] of Object.entries(tillatnaGuide)) { const v = obj(g.svar)[q]; if (val.includes(v)) S.svar.bedoma.guide.svar[q] = v; }
  S.svar.bedoma.egnaKort = arr(b.egnaKort, 30).map((k) => ({ id: obj(k).id, text: txt(obj(k).text, MAX.kort) })).filter((k) => giltigtId(k.id) && k.text);
  const kortId = new Set([...kursfil.beslutskort.map((k) => k.id), ...S.svar.bedoma.egnaKort.map((k) => k.id)]);
  for (const lage of LAGEN) {
    for (const [id, v] of Object.entries(obj(obj(b.placering)[lage]))) if (kortId.has(id) && KLASSER.includes(v)) S.svar.bedoma.placering[lage][id] = v;
  }
  S.svar.bedoma.redovisa = { oense: txt(obj(b.redovisa).oense, MAX.lang) };

  const ge = obj(s.generera);
  for (const [id, v] of Object.entries(obj(ge.prompter))) if (giltigtId(id)) S.svar.generera.prompter[id] = txt(v, MAX.lang);
  S.svar.generera.ideer = arr(ge.ideer, 80).map((i) => ({
    id: obj(i).id, titel: txt(obj(i).titel, MAX.kort), uppgift: txt(obj(i).uppgift, MAX.mellan), av: txt(obj(i).av, 80),
    ofta: ett(obj(i).ofta, ["dagligen", "veckovis", "manadsvis", "sallan"]), samma: ett(obj(i).samma, ["ja", "nej"]),
    info: ett(obj(i).info, ["oppen", "intern", "kund"]),
  })).filter((i) => giltigtId(i.id) && i.titel);
  S.svar.generera.experiment = arr(ge.experiment, 60).map((e) => {
    const x = obj(e);
    return {
      id: x.id, ide: giltigtId(x.ide) ? x.ide : "", titel: txt(x.titel, MAX.kort), ansvarig: txt(x.ansvarig, 80),
      hypotes: txt(x.hypotes, MAX.mellan), test: txt(x.test, MAX.mellan), nulage: txt(x.nulage, MAX.mellan), matt: txt(x.matt, MAX.mellan), misslyckat: txt(x.misslyckat, MAX.mellan),
      timmar: x.timmar === "" || x.timmar === undefined || x.timmar === null ? "" : tal(x.timmar, 0, 10000, ""),
      stopp: datum(x.stopp), klass: ett(x.klass, KLASSER, "hatt"), status: ett(x.status, STATUS, "planerat"),
      resultat: txt(x.resultat, MAX.lang), lardom: txt(x.lardom, MAX.lang), beslut: ett(x.beslut, EXPBESLUT),
    };
  }).filter((e) => giltigtId(e.id) && e.titel);

  const l = obj(s.leda);
  const spr = obj(l.spar);
  S.svar.leda.spar = { framgang: txt(spr.framgang, MAX.lang), laser: txt(spr.laser, MAX.lang), bryta: txt(spr.bryta, MAX.lang) };
  const byg = obj(l.bygga);
  S.svar.leda.bygga = { gemensamt: txt(byg.gemensamt, MAX.lang), fritt: txt(byg.fritt, MAX.lang), synligt: txt(byg.synligt, MAX.lang) };
  const bu = obj(l.budskap);
  S.svar.leda.budskap = { varfor: txt(bu.varfor, MAX.mellan), experiment: txt(bu.experiment, MAX.mellan), misslyckat: txt(bu.misslyckat, MAX.mellan) };
  const ma = obj(l.mandat);
  for (const kol of ["fritt", "fraga", "ledning"]) S.svar.leda.mandat[kol] = arr(ma[kol], 30).map((x) => txt(x, MAX.mellan)).filter(Boolean);
  const ta = obj(l.takt);
  S.svar.leda.takt = { prova: txt(ta.prova, MAX.mellan), redovisa: txt(ta.redovisa, MAX.mellan), besluta: txt(ta.besluta, MAX.mellan), matt: txt(ta.matt, MAX.mellan), nasta: datum(ta.nasta) };
  const kartId = new Set([...S.svar.generera.experiment.map((e) => e.id), ...S.svar.generera.ideer.map((i) => i.id)]);
  for (const [id, v] of Object.entries(obj(l.karta))) if (kartId.has(id) && ZONER.includes(v)) S.svar.leda.karta[id] = v;
  for (const [id, v] of Object.entries(obj(l.flytt))) if (kartId.has(id)) S.svar.leda.flytt[id] = txt(v, MAX.mellan);
  S.svar.leda.redovisa = { mandag: txt(obj(l.redovisa).mandag, MAX.lang) };

  S.beslut = arr(d.beslut, 100).map((x) => ({
    id: obj(x).id, block: ett(obj(x).block, BLOCK, "leda"), text: txt(obj(x).text, MAX.mellan),
    klass: ett(obj(x).klass, ["", ...KLASSER]), ansvarig: txt(obj(x).ansvarig, 80), datum: datum(obj(x).datum),
  })).filter((x) => giltigtId(x.id) && x.text);
  return S;
}

export function sparbart(S) {
  return { format: FORMAT_SPELBOK, version: 1, sparad: idag(), meta: S.meta, kursfil: S.kursfil, svar: S.svar, beslut: S.beslut };
}

// Läser en fil som användaren valt: en spelbok (.html), en sparfil (.json) eller en kursfil (.json).
export function lasFil(text) {
  const t = String(text);
  const m = t.match(/<script type="application\/json" id="leda-data">([\s\S]*?)<\/script>/);
  if (m) return { typ: "spelbok", S: lasTillstand(m[1]) };
  let d;
  try { d = JSON.parse(t); } catch { throw new Error("okand"); }
  if (d && d.format === FORMAT_SPELBOK) return { typ: "spelbok", S: lasTillstand(d) };
  if (d && d.format === FORMAT_KURSFIL) return { typ: "kursfil", kursfil: lasKursfil(d) };
  throw new Error("okand");
}

// ---------- Regler ----------

export function guideForslag(svar = {}) {
  const q = ["angra", "info", "beroende", "kostnad", "karna"];
  if (!q.every((k) => svar[k])) return null;
  const skal = [];
  if (svar.karna === "ja") skal.push("berör prismodell, plattform, policy eller kundavtal");
  if (svar.info === "kund") skal.push("berör kunddata eller personuppgifter");
  if (skal.length) return { klass: "tatuering", skal };
  if (svar.angra === "nej") skal.push("går inte att ångra inom en månad");
  if (svar.beroende === "ja") skal.push("någon blir beroende av det");
  if (svar.kostnad === "nej") skal.push("kostnaden ryms inte i mandatet för en hatt");
  if (skal.length) return { klass: "frisyr", skal };
  return { klass: "hatt", skal: ["går att ångra, binder ingen och ryms i mandatet"] };
}

export function kostnadBerakna(v) {
  const k = kostnadsvarden(v);
  const anvandning = k.anvandare * k.fragor * k.dagar * k.perFraga;
  const licenser = k.anvandare * k.licens * 12;
  const agenter = k.agentUppgifter * k.agentSteg * k.agentPerSteg * 12;
  return { anvandning, licenser, agenter, totalt: anvandning + licenser + agenter, fyrdubbel: anvandning * 4 + licenser + agenter };
}

export function kr(n) {
  const r = Math.round(n);
  return r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " kr";
}

// Alla beslutskort, kursfilens först och sedan egna.
export function allaBeslutskort(S) {
  return [...S.kursfil.beslutskort, ...S.svar.bedoma.egnaKort.map((k) => ({ ...k, forslag: "", motivering: "", egen: true }))];
}

export function flyttade(S) {
  const p = S.svar.bedoma.placering;
  const ut = [];
  for (const k of allaBeslutskort(S)) {
    const a = p.idag[k.id];
    if (!a) continue;
    for (const lage of ["billigt", "last"]) {
      const b = p[lage][k.id];
      if (b && b !== a) ut.push({ kort: k, lage, fran: a, till: b });
    }
  }
  return ut;
}

export function kartobjekt(S) {
  const exp = S.svar.generera.experiment.map((e) => ({ id: e.id, titel: e.titel, typ: "experiment", status: e.status }));
  const medExp = new Set(S.svar.generera.experiment.map((e) => e.ide).filter(Boolean));
  const ide = S.svar.generera.ideer.filter((i) => !medExp.has(i.id)).map((i) => ({ id: i.id, titel: i.titel, typ: "idé" }));
  return [...exp, ...ide].map((o) => ({ ...o, zon: S.svar.leda.karta[o.id] || "explore" }));
}

// ---------- Fortsätt-länken: tillståndet komprimerat i länkens #-del ----------

function tillBase64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function franBase64url(s) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const ut = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) ut[i] = b.charCodeAt(i);
  return ut;
}
async function strom(bytes, ström) {
  const s = new Blob([bytes]).stream().pipeThrough(ström);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export const MAX_LANK = 60000;

export async function packa(S) {
  if (typeof CompressionStream === "undefined") return "";
  const json = new TextEncoder().encode(JSON.stringify(sparbart(S)));
  const z = await strom(json, new CompressionStream("deflate-raw"));
  const kod = tillBase64url(z);
  return kod.length > MAX_LANK ? "" : kod;
}

// ---------- Länk låst med lösenfras: PBKDF2 (SHA-256) och AES-GCM i webbläsarens egen kryptering ----------

export const MIN_FRAS = 8;
const ITER = 250000;

async function nyckel(fras, salt) {
  const bas = await crypto.subtle.importKey("raw", new TextEncoder().encode(fras.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, bas, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function packaLast(S, fras) {
  if (typeof CompressionStream === "undefined" || !globalThis.crypto?.subtle) return "";
  if (typeof fras !== "string" || fras.length < MIN_FRAS) throw new Error("fras");
  const json = new TextEncoder().encode(JSON.stringify(sparbart(S)));
  const z = await strom(json, new CompressionStream("deflate-raw"));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const krypto = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await nyckel(fras, salt), z));
  const allt = new Uint8Array(1 + 16 + 12 + krypto.length);
  allt[0] = 1;
  allt.set(salt, 1); allt.set(iv, 17); allt.set(krypto, 29);
  const kod = tillBase64url(allt);
  return kod.length > MAX_LANK ? "" : kod;
}

export async function packaUppLast(kod, fras) {
  if (!globalThis.crypto?.subtle || typeof DecompressionStream === "undefined") throw new Error("stod");
  if (!/^[A-Za-z0-9_-]{40,}$/.test(kod) || kod.length > MAX_LANK) throw new Error("format");
  const allt = franBase64url(kod);
  if (allt[0] !== 1) throw new Error("format");
  let z;
  try {
    z = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: allt.subarray(17, 29) }, await nyckel(String(fras || ""), allt.subarray(1, 17)), allt.subarray(29)));
  } catch { throw new Error("fras"); }
  const bytes = await strom(z, new DecompressionStream("deflate-raw"));
  if (bytes.length > 2 * 1024 * 1024) throw new Error("storlek");
  return lasTillstand(new TextDecoder().decode(bytes));
}

export async function packaUpp(kod) {
  if (typeof DecompressionStream === "undefined") throw new Error("stod");
  if (!/^[A-Za-z0-9_-]{10,}$/.test(kod) || kod.length > MAX_LANK) throw new Error("format");
  const bytes = await strom(franBase64url(kod), new DecompressionStream("deflate-raw"));
  if (bytes.length > 2 * 1024 * 1024) throw new Error("storlek");
  return lasTillstand(new TextDecoder().decode(bytes));
}

// ---------- Spelboken som fristående HTML-fil ----------

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const stycken = (s) => esc(s).split(/\n+/).map((r) => `<p>${r}</p>`).join("");
const KLASSNAMN = { hatt: "Hatt", frisyr: "Frisyr", tatuering: "Tatuering", "": "" };
const LAGESNAMN = { billigt: "om det blir billigt att bygga", last: "om kunddata låses fast" };
const STATUSNAMN = { planerat: "Planerat", pagar: "Pågår", lyckat: "Klart: lyckat", misslyckat: "Klart: misslyckat", stoppat: "Stoppat" };
const BESLUTNAMN = { "": "", anta: "Anta", justera: "Justera", stoppa: "Stoppa" };
const BLOCKNAMN = { forsta: "Förstå", bedoma: "Bedöma", generera: "Generera", leda: "Leda" };
const ZONNAMN = { explore: "Utforska", grind: "Grinden", exploit: "Driva" };
const UPPGNAMN = { ai: "AI", auto: "Automation", manniska: "Människa" };

export function spelbokHtml(S, kurs, { origin = "", lank = "", lankTyp = "data", logga = "" } = {}) {
  const K = S.kursfil;
  const sv = S.svar;
  const titel = `Ledningens spelbok, ${K.organisation}`;
  const typ = lankTyp === "las" ? "las" : "data";
  const till = (vag, text = "Arbeta vidare i kursen") =>
    origin ? `<a class="vidare" href="${esc(lank ? `${origin}/#${typ}=${lank}&till=${vag}` : `${origin}/#${vag}`)}">${esc(text)}</a>` : "";
  const tom = (t) => `<p class="tom">${esc(t)}</p>`;
  const sek = (id, rubrik, inner, vag) => `<section id="${id}"><h2>${esc(rubrik)}</h2>${inner}${vag ? till(vag) : ""}</section>`;

  const bu = sv.leda.budskap;
  const budskap = bu.varfor || bu.experiment || bu.misslyckat
    ? `<dl class="budskap">${[["Varför AI nu", bu.varfor], ["Varför vi experimenterar", bu.experiment], ["Ett misslyckat test", bu.misslyckat]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${stycken(v)}</dd>`).join("")}</dl>`
    : tom("Budskapet är inte skrivet ännu.");

  const sp = sv.leda.spar;
  const spar = sp.framgang || sp.laser || sp.bryta
    ? `<dl class="budskap">${[["Det som har gjort oss framgångsrika", sp.framgang], ["Så håller det oss kvar", sp.laser], ["Det vi prövar för att bryta spåret", sp.bryta]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${stycken(v)}</dd>`).join("")}</dl>`
    : tom("Spåren är inte beskrivna ännu.");
  const by = sv.leda.bygga;
  const bygga = by.gemensamt || by.fritt || by.synligt
    ? `<dl class="budskap">${[["Det som måste vara gemensamt", by.gemensamt], ["Det som var och en får bygga fritt", by.fritt], ["Så ser vi vad som byggs", by.synligt]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${stycken(v)}</dd>`).join("")}</dl>`
    : tom("Det är inte bestämt ännu.");
  const ma = sv.leda.mandat;
  const bn = K.beslutsnivaer;
  const kolumn = (rubrik, lista, niva) => `<div class="kol ${niva}"><h3>${esc(rubrik)}</h3>${bn[niva]?.vem ? `<p class="vem">${esc(bn[niva].vem)}${bn[niva].grans ? `, ${esc(bn[niva].grans)}` : ""}</p>` : ""}${lista.length ? `<ul>${lista.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : tom("Inget ännu.")}</div>`;
  const mandat = `<div class="tre">${kolumn("Får prövas utan att fråga", ma.fritt, "hatt")}${kolumn("Fråga först", ma.fraga, "frisyr")}${kolumn("Ledningen beslutar", ma.ledning, "tatuering")}</div>`;

  const ta = sv.leda.takt;
  const takt = ta.prova || ta.redovisa || ta.besluta || ta.matt || ta.nasta
    ? `<dl class="rader">${[["Nya tester", ta.prova], ["Redovisning", ta.redovisa], ["Beslut", ta.besluta], ["Mått", ta.matt], ["Nästa gång", ta.nasta]]
      .filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`
    : tom("Takten är inte bestämd ännu.");

  const ex = sv.generera.experiment;
  const experiment = ex.length
    ? `<div class="tabell"><table><thead><tr><th>Experiment</th><th>Ansvarig</th><th>Stopp</th><th>Status</th><th>Beslut</th></tr></thead><tbody>${ex.map((e) =>
      `<tr><td><b>${esc(e.titel)}</b>${e.hypotes ? `<br><span class="liten">${esc(e.hypotes)}</span>` : ""}${e.nulage ? `<br><span class="liten">Jämfört med i dag: ${esc(e.nulage)}</span>` : ""}${e.lardom ? `<br><span class="liten">Lärdom: ${esc(e.lardom)}</span>` : ""}</td><td>${esc(e.ansvarig)}</td><td>${esc(e.stopp)}</td><td>${esc(STATUSNAMN[e.status])}</td><td>${esc(BESLUTNAMN[e.beslut])}</td></tr>`).join("")}</tbody></table></div>`
    : tom("Inga experimentkort ännu.");

  const bs = S.beslut;
  const beslut = bs.length
    ? `<div class="tabell"><table><thead><tr><th>Beslut</th><th>Klass</th><th>Ansvarig</th><th>Datum</th><th>Block</th></tr></thead><tbody>${bs.map((b) =>
      `<tr><td>${esc(b.text)}</td><td>${esc(KLASSNAMN[b.klass])}</td><td>${esc(b.ansvarig)}</td><td>${esc(b.datum)}</td><td>${esc(BLOCKNAMN[b.block])}</td></tr>`).join("")}</tbody></table></div>`
    : tom("Inga beslut ännu.");

  const kort = allaBeslutskort(S);
  const pl = sv.bedoma.placering.idag;
  const klassat = kort.filter((k) => pl[k.id]);
  const fl = flyttade(S);
  const klassning = klassat.length
    ? `<div class="tre">${KLASSER.map((kl) => `<div class="kol ${kl}"><h3>${esc(KLASSNAMN[kl])}</h3><ul>${klassat.filter((k) => pl[k.id] === kl).map((k) => `<li>${esc(k.text)}</li>`).join("")}</ul></div>`).join("")}</div>${
      fl.length ? `<h3>Beslut som bytte klass</h3><ul>${fl.map((f) => `<li>${esc(f.kort.text)}: ${esc(KLASSNAMN[f.fran])} blir ${esc(KLASSNAMN[f.till])} ${esc(LAGESNAMN[f.lage])}</li>`).join("")}</ul>` : ""}${
      sv.bedoma.redovisa.oense ? `<h3>Där vi var oense</h3>${stycken(sv.bedoma.redovisa.oense)}` : ""}`
    : tom("Besluten är inte klassade ännu.");

  const ko = kartobjekt(S);
  const karta = ko.length
    ? `<div class="tre">${ZONER.map((z) => `<div class="kol ${z}"><h3>${esc(ZONNAMN[z])}</h3><ul>${ko.filter((o) => o.zon === z).map((o) => `<li>${esc(o.titel)}${sv.leda.flytt[o.id] ? `<br><span class="liten">För att flytta: ${esc(sv.leda.flytt[o.id])}</span>` : ""}</li>`).join("")}</ul></div>`).join("")}</div>`
    : tom("Inga experiment eller idéer att placera ännu.");

  const id = sv.generera.ideer;
  const ideer = id.length ? `<ul>${id.map((i) => `<li><b>${esc(i.titel)}</b>${i.uppgift ? `: ${esc(i.uppgift)}` : ""}${i.av ? ` <span class="liten">(${esc(i.av)})</span>` : ""}${i.samma === "ja" ? ' <span class="liten">Automation snarare än AI</span>' : ""}</li>`).join("")}</ul>` : tom("Inga idéer ännu.");

  const fo = sv.forsta;
  const kalk = fo.kostnad ? kostnadBerakna(fo.kostnad) : null;
  const uppg = K.uppgiftskort.filter((u) => fo.uppgifter[u.id]);
  const forsta = [
    fo.redovisa.overraskade ? `<h3>Det som överraskade</h3>${stycken(fo.redovisa.overraskade)}` : "",
    fo.redovisa.veta ? `<h3>Det vi behöver veta mer om</h3>${stycken(fo.redovisa.veta)}` : "",
    fo.f1.skillnad || fo.f1.tal ? `<h3>Samma fråga tre gånger</h3>${stycken(fo.f1.skillnad)}${stycken(fo.f1.tal)}` : "",
    uppg.length ? `<h3>AI, automation eller människa</h3><ul>${uppg.map((u) => `<li>${esc(u.text)}: <b>${esc(UPPGNAMN[fo.uppgifter[u.id]])}</b>${fo.kommentar[u.id] ? ` <span class="liten">${esc(fo.kommentar[u.id])}</span>` : ""}</li>`).join("")}</ul>` : "",
    kalk ? `<h3>Kostnadsexemplet</h3><p>Med ${esc(fo.kostnad.anvandare)} användare: cirka ${esc(kr(kalk.totalt))} per år, varav användning ${esc(kr(kalk.anvandning))}, licenser ${esc(kr(kalk.licenser))} och agenter ${esc(kr(kalk.agenter))}. Om användningen fyrdubblas: ${esc(kr(kalk.fyrdubbel))}. Siffrorna bygger på antaganden.</p>` : "",
  ].join("") || tom("Inget antecknat ännu.");

  const regler = `${K.spelregler.principer.length ? `<ul>${K.spelregler.principer.map((p) => `<li><b>${esc(p.rubrik)}.</b> ${esc(p.text)}</li>`).join("")}</ul>` : ""}${
    K.spelregler.regler.length ? `<ul>${K.spelregler.regler.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}${K.spelregler.kalla ? `<p class="liten">Källa: ${esc(K.spelregler.kalla)}</p>` : ""}`;

  const data = JSON.stringify(sparbart(S)).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const fa = sv.fall;
  const SJ = { ja: "Ja", delvis: "Delvis", nej: "Inte än" };
  const malRader = kurs.block.map((b) => {
    const m = sv[b.id].mal;
    const rader = b.mal.map((t, i) => (m[i] ? `<li>${esc(t)}: <b>${esc(SJ[m[i]])}</b></li>` : "")).join("");
    return rader ? `<h3>${esc(b.namn)}</h3><ul>${rader}</ul>` : "";
  }).join("");
  const blockFall = kurs.block.filter((b) => sv[b.id].fall).map((b) => `<h3>${esc(b.namn)}</h3>${stycken(sv[b.id].fall)}`).join("");
  const fallet = fa.fraga || fa.varfor || fa.kunna || blockFall || malRader
    ? `${fa.fraga ? `<p class="fall">${esc(fa.fraga)}</p>` : ""}${fa.varfor ? `<h3>Varför den är viktig nu</h3>${stycken(fa.varfor)}` : ""}${fa.kunna ? `<h3>Det här ville vi kunna efter kursen</h3>${stycken(fa.kunna)}` : ""}${blockFall ? `<h3 class="mellanrubrik">Så besvarade blocken vår fråga</h3>${blockFall}` : ""}${malRader ? `<h3 class="mellanrubrik">Självskattning mot lärandemålen</h3>${malRader}` : ""}`
    : tom("Ledningens case är inte formulerat ännu.");
  const uv = sv.utvardering;
  const NY = { mycket: "Mycket", ganska: "Ganska", lite: "Lite", inte: "Inte alls" };
  const utvardering = utvarderingText(S) ? `${uv.nytta || uv.nyttor.length ? `<p><b>Hur användbar var kursen?</b> ${esc([uv.nytta ? `gruppen: ${NY[uv.nytta].toLowerCase()}` : "", ...NYTTA.map((v) => { const n = uv.nyttor.filter((x) => x === v).length; return n ? `${NY[v].toLowerCase()}: ${n}` : ""; })].filter(Boolean).join(", "))}</p>` : ""}${
    [["Det som fungerade bäst", uv.basta], ["Det vi skulle ändra eller ta bort", uv.andra], ["Det som saknades", uv.saknas]].filter(([, v]) => v).map(([k, v]) => `<h3>${esc(k)}</h3>${stycken(v)}`).join("")}`
    : tom("Kursen är inte utvärderad ännu.");
  const deltagare = S.meta.deltagare.length ? ` · ${esc(S.meta.deltagare.join(", "))}` : "";

  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<meta name="referrer" content="no-referrer">
<title>${esc(titel)}</title>
<style>
:root{--paper:#f6f4ef;--ink:#1d2733;--muted:#5d6773;--line:#ddd8cd;--accent:#2f6b5e;--accent-soft:#e3eeea;--ochre:#a57a12;--ochre-soft:#f5ecd3;--rust:#b8532c;--rust-soft:#f6e4dc;--serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 var(--sans)}
main{max-width:980px;margin:0 auto;padding:32px 16px 24px}
h1,h2,h3{font-family:var(--serif);font-weight:600;line-height:1.2}h1{font-size:clamp(28px,5vw,40px);margin:0 0 8px}h2{font-size:24px;margin:0 0 12px}h3{font-size:17px;margin:14px 0 6px}
p{margin:0 0 10px;max-width:70ch}.eyebrow{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);font-weight:600}
.lead{color:var(--muted)}section{background:#fff;border:1px solid var(--line);border-radius:10px;padding:20px 22px;margin:0 0 16px;break-inside:avoid}
.tom{color:var(--muted);font-style:italic}.liten{font-size:14px;color:var(--muted)}.vem{font-size:14px;color:var(--muted);margin:0 0 6px}
.tre{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.kol{border-radius:8px;padding:10px 14px;background:var(--paper)}.kol h3{margin-top:0}
.kol.hatt,.kol.explore{background:var(--accent-soft)}.kol.frisyr,.kol.grind{background:var(--ochre-soft)}.kol.tatuering,.kol.exploit{background:var(--rust-soft)}
.kol ul{padding-left:18px;margin:0}.kol li{margin-bottom:4px}
dl{margin:0}dt{font-weight:600;margin-top:10px}dd{margin:2px 0 0}.rader{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px}.rader dt,.rader dd{margin:0}
.tabell{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:15px}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}th{font-size:13px;color:var(--muted)}
.vidare{display:inline-block;margin-top:12px;font-weight:600;color:var(--accent);font-size:15px}
.fortsatt{background:var(--accent);color:#fff;border-radius:10px;padding:16px 20px;margin:0 0 20px}.fortsatt a{color:#fff;font-weight:600}
.klass{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--rust);border:1px solid var(--rust);border-radius:4px;padding:2px 8px;margin-left:8px;vertical-align:middle}
.fall{font:600 20px/1.35 var(--serif);border-left:3px solid var(--ochre);padding-left:12px}.mellanrubrik{margin-top:20px;padding-top:12px;border-top:1px solid var(--line)}
nav.inneh{font-size:14px;margin:0 0 20px;display:flex;flex-wrap:wrap;gap:4px 14px}nav.inneh a{color:var(--accent)}
footer{max-width:980px;margin:0 auto;padding:16px 16px 40px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center}
footer img{width:22px;height:22px;opacity:.72;image-rendering:pixelated}
@media (max-width:700px){.tre{grid-template-columns:1fr}.rader{grid-template-columns:1fr}}
@media print{body{background:#fff}section{border:0;padding:0 0 12px}.fortsatt,.vidare,nav.inneh{display:none}}
</style>
</head>
<body>
<main>
<div class="eyebrow">${esc(kurs.namn)}<span class="klass">Intern</span></div>
<h1>Ledningens spelbok</h1>
<p class="lead">${esc(K.organisation)} · ${esc(S.meta.grupp || K.grupp)}${deltagare} · sparad ${esc(idag())}</p>
${origin ? `<div class="fortsatt">${lank ? `<a href="${esc(`${origin}/#${typ}=${lank}&till=spelbok`)}">Öppna kursen med allt vi har gjort</a><br><span>${typ === "las"
    ? "Länken är låst med en lösenfras som inte finns i den här filen. Den skickas inte till någon server."
    : "Länken bär innehållet själv och skickas inte till någon server, men den som har länken kan läsa innehållet. Dela den bara med dem som får läsa spelboken."}</span>` : `Läs in den här filen på <a href="${esc(origin)}/">${esc(origin.replace(/^https?:\/\//, ""))}</a> för att arbeta vidare.`}</div>` : ""}
<nav class="inneh" aria-label="Innehåll"><a href="#fall">Vårt case</a><a href="#spar">Spår</a><a href="#bygga">Bygga själva</a><a href="#budskap">Budskap</a><a href="#mandat">Mandat</a><a href="#takt">Takt</a><a href="#experiment">Experiment</a><a href="#beslut">Beslut</a><a href="#klassning">Klassning</a><a href="#karta">Försök och drift</a><a href="#ideer">Idéer</a><a href="#forsta">Det vi lärde oss</a><a href="#spelregler">Spelregler</a><a href="#utvardering">Utvärdering</a></nav>
${sek("fall", "Ledningens case", fallet, "start/fall")}
${sek("spar", "Våra spår", spar, "leda/ov-spar")}
${sek("bygga", "Det vi bygger själva", bygga, "leda/ov-bygga")}
${sek("budskap", "Budskapet", budskap, "leda/ov-budskap")}
${sek("mandat", "Mandatet", mandat, "leda/ov-mandat")}
${sek("takt", "Takten", takt, "leda/ov-takt")}
${sek("experiment", "Experiment", experiment, "generera/ov-experiment")}
${sek("beslut", "Beslut", beslut, "leda/besluta")}
${sek("klassning", "Hur vi klassar besluten", klassning, "bedoma/ov-sortera")}
${sek("karta", "Från försök till drift", karta, "leda/ov-karta")}
${sek("ideer", "Idéer i flödet", ideer, "generera/ov-ideer")}
${sek("forsta", "Det vi lärde oss", forsta, "forsta/redovisa")}
${sek("spelregler", "Våra spelregler", regler, "")}
${sek("utvardering", "Utvärdering av kursen", utvardering, "leda/utvardering")}
</main>
<footer>${logga ? `<img src="${esc(logga)}" alt="Mickla">` : ""}<span>${esc(kurs.upphov)}</span><span>${esc(kurs.namn)} · ${esc(kurs.version)}</span></footer>
<script type="application/json" id="leda-data">${data}</script>
</body>
</html>
`;
}

// ---------- Sammanslagning: deltagarnas bidrag in i kursledarens spelbok ----------

// Slår ihop text utan att något försvinner. Samma eller redan ingående text ger inget nytt.
export function slaIhopText(a, b, av) {
  const x = (a || "").trim();
  const y = (b || "").trim();
  if (!y || x === y || x.includes(y)) return a || "";
  if (!x || y.includes(x)) return b;
  return `${a}\n\n${av ? `${av}: ` : ""}${b}`;
}

export function slaIhop(Sa, Sb, av = "") {
  if (Sa.kursfil.organisation !== Sb.kursfil.organisation) throw new Error("organisation");
  const A = JSON.parse(JSON.stringify(sparbart(Sa)));
  const B = sparbart(Sb);
  const r = { av, ideer: 0, experiment: 0, uppdateradeExperiment: 0, beslut: 0, kort: 0, texter: 0, placeringar: 0, oenighet: [] };
  const text = (obj, nyckel, varde) => {
    const ny = slaIhopText(obj[nyckel], varde, av);
    if (ny !== (obj[nyckel] || "")) { obj[nyckel] = ny; r.texter += 1; }
  };
  const a = A.svar;
  const b = B.svar;

  A.meta.deltagare = [...new Set([...A.meta.deltagare, ...B.meta.deltagare, ...(av ? [av] : [])])].slice(0, 30);

  for (const k of ["fraga", "varfor", "kunna"]) text(a.fall, k, b.fall[k]);
  for (const bl of BLOCK) {
    text(a[bl], "fall", b[bl].fall);
    for (const [i, v] of Object.entries(b[bl].mal)) if (!a[bl].mal[i]) a[bl].mal[i] = v;
    for (const [k, v] of Object.entries(b[bl].redovisa || {})) if (typeof v === "string") text(a[bl].redovisa, k, v);
  }
  for (const k of ["skillnad", "tal"]) text(a.forsta.f1, k, b.forsta.f1[k]);
  if (!a.forsta.kostnad && b.forsta.kostnad) a.forsta.kostnad = b.forsta.kostnad;

  const kortnamn = Object.fromEntries([...Sa.kursfil.uppgiftskort, ...Sa.kursfil.beslutskort, ...a.bedoma.egnaKort, ...b.bedoma.egnaKort].map((k) => [k.id, k.text]));
  for (const [id, v] of Object.entries(b.forsta.uppgifter)) {
    const x = a.forsta.uppgifter[id];
    if (!x) { a.forsta.uppgifter[id] = v; r.placeringar += 1; } else if (x !== v) r.oenighet.push({ typ: "uppgift", id, text: kortnamn[id] || id, vi: x, de: v });
  }
  for (const [id, v] of Object.entries(b.forsta.kommentar)) text(a.forsta.kommentar, id, v);

  const egnaText = new Set(a.bedoma.egnaKort.map((k) => k.text.trim().toLowerCase()));
  const egnaId = new Set(a.bedoma.egnaKort.map((k) => k.id));
  for (const k of b.bedoma.egnaKort) {
    if (egnaId.has(k.id) || egnaText.has(k.text.trim().toLowerCase())) continue;
    a.bedoma.egnaKort.push(k); egnaId.add(k.id); r.kort += 1;
  }
  for (const lage of LAGEN) {
    for (const [id, v] of Object.entries(b.bedoma.placering[lage])) {
      if (!egnaId.has(id) && !Sa.kursfil.beslutskort.some((k) => k.id === id)) continue;
      const x = a.bedoma.placering[lage][id];
      if (!x) { a.bedoma.placering[lage][id] = v; r.placeringar += 1; } else if (x !== v && lage === "idag") r.oenighet.push({ typ: "beslut", id, text: kortnamn[id] || id, vi: x, de: v });
    }
  }
  if (!a.bedoma.guide.titel && b.bedoma.guide.titel) a.bedoma.guide = b.bedoma.guide;

  for (const [id, v] of Object.entries(b.generera.prompter)) text(a.generera.prompter, id, v);
  if (a.generera.mandatTimmar === "" && b.generera.mandatTimmar !== "") a.generera.mandatTimmar = b.generera.mandatTimmar;
  // Utvärderingen slås ihop utan namn, så att den kan vara ärlig.
  for (const k of ["basta", "andra", "saknas"]) {
    const ny = slaIhopText(a.utvardering[k], b.utvardering[k], "");
    if (ny !== a.utvardering[k]) { a.utvardering[k] = ny; r.texter += 1; }
  }
  if (b.utvardering.nytta && b.utvardering.nytta !== a.utvardering.nytta) a.utvardering.nyttor = [...a.utvardering.nyttor, b.utvardering.nytta].slice(0, 60);
  const ideId = new Set(a.generera.ideer.map((i) => i.id));
  for (const i of b.generera.ideer) if (!ideId.has(i.id)) { a.generera.ideer.push(i); ideId.add(i.id); r.ideer += 1; }
  const expMap = new Map(a.generera.experiment.map((e) => [e.id, e]));
  for (const e of b.generera.experiment) {
    const x = expMap.get(e.id);
    if (!x) { a.generera.experiment.push(e); expMap.set(e.id, e); r.experiment += 1; continue; }
    const fore = JSON.stringify(x);
    for (const k of ["hypotes", "test", "nulage", "matt", "misslyckat", "resultat", "lardom"]) x[k] = slaIhopText(x[k], e[k], "");
    for (const k of ["ansvarig", "stopp", "timmar", "beslut"]) if ((x[k] === "" || x[k] === undefined) && e[k] !== "") x[k] = e[k];
    const steg = (st) => ({ planerat: 0, pagar: 1 }[st] ?? 2);
    if (steg(e.status) > steg(x.status)) x.status = e.status;
    if (JSON.stringify(x) !== fore) r.uppdateradeExperiment += 1;
  }

  const l = a.leda;
  for (const k of ["varfor", "experiment", "misslyckat"]) text(l.budskap, k, b.leda.budskap[k]);
  for (const k of ["framgang", "laser", "bryta"]) text(l.spar, k, b.leda.spar[k]);
  for (const k of ["gemensamt", "fritt", "synligt"]) text(l.bygga, k, b.leda.bygga[k]);
  for (const kol of ["fritt", "fraga", "ledning"]) {
    const finns = new Set(l.mandat[kol].map((t) => t.trim().toLowerCase()));
    for (const t of b.leda.mandat[kol]) if (!finns.has(t.trim().toLowerCase())) { l.mandat[kol].push(t); finns.add(t.trim().toLowerCase()); r.texter += 1; }
  }
  for (const k of ["prova", "redovisa", "besluta", "matt"]) text(l.takt, k, b.leda.takt[k]);
  if (!l.takt.nasta && b.leda.takt.nasta) l.takt.nasta = b.leda.takt.nasta;
  for (const [id, v] of Object.entries(b.leda.karta)) if (!l.karta[id]) l.karta[id] = v;
  for (const [id, v] of Object.entries(b.leda.flytt)) text(l.flytt, id, v);

  const beslutId = new Set(A.beslut.map((x) => x.id));
  const beslutText = new Set(A.beslut.map((x) => x.text.trim().toLowerCase()));
  for (const x of B.beslut) {
    if (beslutId.has(x.id) || beslutText.has(x.text.trim().toLowerCase())) continue;
    A.beslut.push(x); beslutId.add(x.id); beslutText.add(x.text.trim().toLowerCase()); r.beslut += 1;
  }
  return { S: lasTillstand(A), rapport: r };
}

// ---------- Kursfilsverktyget ----------

export function slugId(text, upptagna = new Set()) {
  const bas = String(text || "kort").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "") || "kort";
  let id = /^[a-z0-9]/.test(bas) ? bas : `k-${bas}`.slice(0, 32);
  let n = 2;
  while (upptagna.has(id)) id = `${bas.slice(0, 32)}-${n++}`;
  upptagna.add(id);
  return id;
}

// Ger varje kort ett giltigt och unikt id, utan att ändra id som redan fungerar.
export function medId(k) {
  const ut = JSON.parse(JSON.stringify(k));
  for (const lista of ["beslutskort", "uppgiftskort"]) {
    const upptagna = new Set();
    ut[lista] = arr(ut[lista], 40).map((x) => {
      const y = { ...obj(x) };
      y.id = giltigtId(y.id) && !upptagna.has(y.id) ? (upptagna.add(y.id), y.id) : slugId(y.text, upptagna);
      return y;
    });
  }
  return ut;
}

export function tomKursfil() {
  return lasKursfil({ format: FORMAT_KURSFIL, organisation: "Ny organisation" });
}

export function kursfilTillJson(k) {
  const m = medId(k);
  return {
    format: FORMAT_KURSFIL,
    version: 1,
    _om: `Kursfil för ${m.organisation}. Läses in lokalt i webbläsaren och lämnar aldrig datorn. Lägg aldrig filen i ett publikt repo.`,
    organisation: m.organisation, grupp: m.grupp, beskrivning: m.beskrivning, caseforslag: m.caseforslag,
    sammanhang: m.sammanhang, spelregler: m.spelregler, beslutsnivaer: m.beslutsnivaer,
    beslutskort: m.beslutskort, uppgiftskort: m.uppgiftskort, kostnad: kostnadsvarden(m.kostnad),
  };
}

// Tolkar det ett AI-verktyg svarat: tar bort kodstaket och text runt JSON, ger kort id och läser försiktigt.
export function tolkaAiSvar(text) {
  let t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const slut = t.lastIndexOf("}");
  if (start < 0 || slut <= start) throw new Error("json");
  let d;
  try { d = JSON.parse(t.slice(start, slut + 1)); } catch { throw new Error("json"); }
  if (!d || typeof d !== "object") throw new Error("json");
  d.format = FORMAT_KURSFIL;
  const saknas = arr(d._saknas, 30).map((x) => txt(x, MAX.mellan)).filter(Boolean);
  return { kursfil: lasKursfil(medId(d)), saknas };
}

function allaTexter(v, ut = []) {
  if (typeof v === "string") ut.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allaTexter(x, ut));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => allaTexter(x, ut));
  return ut;
}

export function tankstreckIKursfil(k) {
  return allaTexter(k).reduce((n, t) => n + (t.match(/[\u2013\u2014]/g) || []).length, 0);
}

export function bytTankstreck(k) {
  const fix = (v) => {
    if (typeof v === "string") return v.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1 till $2").replace(/\s*[\u2013\u2014]\s*/g, ", ");
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([a, b]) => [a, fix(b)]));
    return v;
  };
  return fix(k);
}

export function kursfilVarningar(k) {
  const v = [];
  const m = medId(k);
  if (!m.organisation || /ny organisation|påhittat/i.test(m.organisation)) v.push("Ange organisationens namn.");
  if (!m.beskrivning) v.push("Beskrivningen saknas. Prompterna i övningarna blir då allmänna.");
  if (m.caseforslag.length < 2) v.push("Lägg till minst två förslag på ledningens case.");
  if (!m.sammanhang.length) v.push("Sammanhanget (strategi, årets fokus) saknas.");
  if (m.spelregler.principer.length + m.spelregler.regler.length === 0) v.push("Spelreglerna saknas. Hämta dem ur kundens AI-policy och instruktion.");
  for (const n of ["hatt", "frisyr", "tatuering"]) if (!m.beslutsnivaer[n].vem) v.push(`Beslutsnivån ${n} saknar vem som beslutar.`);
  if (m.beslutskort.length < 6) v.push(`Bara ${m.beslutskort.length} beslutskort. Sex till tio fungerar bäst.`);
  for (const kl of KLASSER) if (m.beslutskort.length && !m.beslutskort.some((b) => b.forslag === kl)) v.push(`Inget beslutskort har förslaget ${kl}.`);
  if (m.beslutskort.some((b) => !b.forslag)) v.push("Något beslutskort saknar förslag på klass.");
  if (m.uppgiftskort.length < 6) v.push(`Bara ${m.uppgiftskort.length} uppgiftskort. Sex till tio fungerar bäst.`);
  for (const [id, namn] of [["ai", "AI"], ["auto", "automation"], ["manniska", "människa"]]) if (m.uppgiftskort.length && !m.uppgiftskort.some((u) => u.svar === id)) v.push(`Inget uppgiftskort har svaret ${namn}.`);
  if (m.uppgiftskort.some((u) => !u.svar)) v.push("Något uppgiftskort saknar svar.");
  const ts = tankstreckIKursfil(m);
  if (ts) v.push(`Tankstreck på ${ts} ställen.`);
  return v;
}

// ---------- Kursutvärderingen som text, att skicka till kursledaren ----------

export function utvarderingText(S) {
  const uv = S.svar.utvardering;
  const NY = { mycket: "mycket", ganska: "ganska", lite: "lite", inte: "inte alls" };
  const rader = [];
  if (uv.nytta) rader.push(`Hur användbar var kursen? Gruppen: ${NY[uv.nytta]}.`);
  if (uv.nyttor.length) rader.push(`Enskilda svar: ${NYTTA.map((v) => { const n = uv.nyttor.filter((x) => x === v).length; return n ? `${NY[v]} ${n}` : ""; }).filter(Boolean).join(", ")}.`);
  for (const [k, v] of [["Det som fungerade bäst", uv.basta], ["Det vi skulle ändra eller ta bort", uv.andra], ["Det som saknades", uv.saknas]]) if (v.trim()) rader.push(`${k}:\n${v.trim()}`);
  return rader.join("\n\n");
}

export function siffraSomOrd(n) {
  const ord = ["noll", "en", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio", "tio", "elva", "tolv"];
  return Number.isInteger(n) && n >= 0 && n < ord.length ? ord[n] : String(n);
}

// ---------- Kontaktformuläret: ett färdigt mejl i besökarens eget e-postprogram ----------

export const MAX_MEJL = 1500;

export function kontaktMejl(kontakt, falt) {
  const adress = kontakt.adress.join("@");
  const amne = kontakt.amnen.includes(falt.amne) ? falt.amne : kontakt.amnen[0];
  const namn = txt(falt.namn, 120).trim();
  const org = txt(falt.organisation, 160).trim();
  const medd = txt(falt.meddelande, MAX_MEJL).trim();
  const kropp = [medd, "", namn ? `Hälsningar\n${namn}` : "", org].filter((x, i) => x || i === 1).join("\n").trim();
  return {
    adress,
    amne: `Leda i AI-takt: ${amne}`,
    kropp,
    lank: `mailto:${adress}?subject=${encodeURIComponent(`Leda i AI-takt: ${amne}`)}&body=${encodeURIComponent(kropp)}`,
  };
}
