// Kontroller före publicering: inga externa resurser, ingen innerHTML, inga tankstreck, CSP finns,
// och inga verkliga kursfiler eller spelböcker i repot.
import fs from "node:fs";
import path from "node:path";

const rot = new URL("../publik/", import.meta.url).pathname;
const repo = new URL("../", import.meta.url).pathname;
const fel = [];
const tillatnaAdresser = [/^http:\/\/www\.w3\.org\//, /^http:\/\/localhost/];

function gaIgenom(dir, fn) {
  for (const namn of fs.readdirSync(dir)) {
    if (namn === "node_modules" || namn === ".git") continue;
    const fil = path.join(dir, namn);
    if (fs.statSync(fil).isDirectory()) gaIgenom(fil, fn); else fn(fil);
  }
}

gaIgenom(rot, (fil) => {
  if (!/\.(html|js|css|json)$/.test(fil)) return;
  const text = fs.readFileSync(fil, "utf8");
  const kort = path.relative(rot, fil);
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    if (!tillatnaAdresser.some((r) => r.test(m[0]))) fel.push(`${kort}: extern adress ${m[0]}`);
  }
  if (/\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write/.test(text)) fel.push(`${kort}: HTML läggs in som kod`);
  if (/\beval\(|new Function\(/.test(text)) fel.push(`${kort}: eval eller new Function`);
  if (/localStorage/.test(text)) fel.push(`${kort}: localStorage används (bara sessionStorage är tillåtet)`);
  if (/[–—]/.test(text)) fel.push(`${kort}: tankstreck i texten`);
  if (/Plan B|planbab/i.test(text)) fel.push(`${kort}: kundnamn i publik kod (kursen nämner inga kunder)`);
  if (/[a-z0-9._-]+@mickla\.se/i.test(text)) fel.push(`${kort}: e-postadress i klartext`);
  if (/style="/.test(text) && !/modell\.js$/.test(fil)) fel.push(`${kort}: style-attribut (blockeras av CSP)`);
});

// Kursfiler och spelböcker: bara den påhittade mallen får ligga i repot.
gaIgenom(repo, (fil) => {
  const kort = path.relative(repo, fil);
  if (/\.json$/.test(fil) && !/package(-lock)?\.json$/.test(fil)) {
    let d = null;
    try { d = JSON.parse(fs.readFileSync(fil, "utf8")); } catch { return; }
    if (d && d.format === "mickla-leda-kursfil" && !/påhittat/i.test(String(d.organisation))) fel.push(`${kort}: verklig kursfil i repot (organisationen måste vara märkt påhittat)`);
    if (d && d.format === "mickla-leda-spelbok") fel.push(`${kort}: sparad spelbok i repot`);
  }
  if (/\.html?$/.test(fil) && /id="leda-data"/.test(fs.readFileSync(fil, "utf8"))) fel.push(`${kort}: sparad spelbok i repot`);
  if (/\.(docx|xlsx|pdf|pptx)$/i.test(fil)) fel.push(`${kort}: dokument får inte ligga i repot`);
});

const html = fs.readFileSync(path.join(rot, "index.html"), "utf8");
if (!/Content-Security-Policy[^>]*default-src 'none'/.test(html)) fel.push("index.html: Content Security Policy saknas");
for (const f of ["img/mickla.png", "exempel/Exempel_kursfil.json", "CNAME", "innehall/kurs.js", "app.js", "modell.js", "style.css"]) {
  if (!fs.existsSync(path.join(rot, f))) fel.push(`saknas: publik/${f}`);
}
for (const f of fs.readdirSync(path.join(rot, "exempel"))) if (!/^Exempel_/.test(f)) fel.push(`publik/exempel/${f}: bara påhittade exempelfiler får ligga i repot`);

for (const f of ["CLAUDE.md", "README.md"]) {
  if (fs.existsSync(path.join(repo, f)) && /Plan B|planbab/i.test(fs.readFileSync(path.join(repo, f), "utf8"))) fel.push(`${f}: kundnamn i det publika repot`);
}
if (fel.length) { console.error("Kontrollen hittade problem:\n" + fel.map((f) => " - " + f).join("\n")); process.exit(1); }
console.log("Kontrollen gick igenom.");
