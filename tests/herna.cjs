// Napojení na Hernu (protokol verze 1, react-apps/HERNA-PROTOKOL.md): hra v iframe pod vlastním „rodičem“, který dělá to, co Herna
// (lišta 48 px nad iframe, příjem postMessage jen z vlastního iframe). Dva prohlížeče: Chromium desktop 1440×900 (Mark) a WebKit iPhone 13 (Radka).
// Ověřuje: meta řádek, #herna=1 bez výzvy i setupu (druhý hráč čeká na založení a sedne si sám), skryté sdílení / „Zkusit sám“ / odkazy ven,
// zprávy pripraveno / stav (ceka, hraje, konec) / vysledek (sedadlo Herny, ne x/o; remíza = null; jednou na okno se stejnou partií) / jina-hra,
// obě rozdělení sedadel (zakladatel je sedadlo 0 i 1) a jména s čárkou, &, % a diakritikou, obnovení stránky v partii,
// a že bez platného herna=1 se hra chová postaru (úvod, žádné zprávy rodiči).
// Síť: na localhostu falešná sdílená (rychlé), na jiné adrese (živé Pages) skutečný mantledb.sh. Vynutit: SITE=fake|real.
// node tests/herna.cjs [URL]   (výchozí http://127.0.0.1:8805/)   snímky: tests/shots/herna/ (proměnná SHOTS)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const H = require("./pomocne.cjs");
const S = require("../engine.js");
const BASE = (process.argv[2] || "http://127.0.0.1:8805/").replace(/#.*$/, "");
const FAKE = (process.env.SITE || (/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE) ? "fake" : "real")) === "fake";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots", "herna");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
}
const T = 25000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => [...Array(12)].map(() => Math.floor(Math.random() * 36).toString(36)).join("");

const PARENT = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#16181d}.bar{height:48px;color:#fff;font:14px/48px sans-serif;padding:0 12px}.f{position:absolute;top:48px;left:0;right:0;bottom:0}iframe{width:100%;height:100%;border:0}</style>
<div class=bar>Herna (zkušební rodič)</div><div class=f><iframe id=g allow="clipboard-read; clipboard-write; fullscreen; autoplay"></iframe></div>
<script>window.__msgs=[];addEventListener("message",e=>{if(e.source===document.getElementById("g").contentWindow)__msgs.push(e.data)});
document.getElementById("g").src=decodeURIComponent(location.search.slice(5));</script>`;

(async () => {
  const meta = await (await fetch(BASE)).text();
  check("index.html má <meta name=\"herna-protokol\" content=\"1\"> (stejný test jako Herna)", /<meta[^>]+name=["']herna-protokol["'][^>]*content=["']1["']/i.test(meta));

  const bA = await chromium.launch(), bB = await webkit.launch();
  const store = {};
  const errs = [];
  async function open(browser, opts, tag) {
    const ctx = await browser.newContext(opts);
    if (FAKE) await ctx.route("https://mantledb.sh/**", route => {
      const r = route.request(), u = r.url();
      if (r.method() === "GET") return route.fulfill(store[u] ? { status: 200, contentType: "application/json", body: store[u] } : { status: 404, body: "" });
      if (r.method() === "POST") { store[u] = r.postData(); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
      route.continue();
    });
    await ctx.route(/__herna\.html/, route => route.fulfill({ status: 200, contentType: "text/html", body: PARENT }));
    const page = await ctx.newPage();
    page.on("pageerror", e => errs.push(tag + ": " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|fonts\./.test(m.text())) errs.push(tag + " console: " + m.text()); });
    return page;
  }
  const A = await open(bA, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, "Mark");
  const B = await open(bB, { ...devices["iPhone 13"] }, "Radka");

  const hash = (r, seat, names, zaklada, m = "test000000") => `#herna=1&m=${m}&r=${r}&seat=${seat}&names=${names.map(encodeURIComponent).join(",")}&zaklada=${zaklada}`;
  const enter = (p, h) => p.goto(`${BASE}__herna.html?src=${encodeURIComponent(BASE + h)}`, { waitUntil: "load" });
  const F = p => p.frames().find(f => f !== p.mainFrame());
  const msgs = p => p.evaluate(() => window.__msgs.slice());
  const phases = async p => (await msgs(p)).filter(z => z.typ === "stav").map(z => z.faze);
  const results = async p => (await msgs(p)).filter(z => z.typ === "vysledek");
  const frameReady = async (p, sel, ms = T) => { const t = Date.now() + ms; while (Date.now() < t) { const f = F(p); if (f) { try { if (await f.locator(sel).first().isVisible()) return true; } catch {} } await sleep(150); } return false; };
  const docOf = async r => {
    const u = `https://mantledb.sh/v2/zviratka-${r}/hra`;
    if (FAKE) return store[u] ? JSON.parse(store[u]) : null;
    const x = await fetch(u, { cache: "no-store" }); return x.ok ? x.json() : null;
  };
  const myTurn = (p, timeout = T) => F(p).waitForFunction(() => document.title.startsWith("Jsi na tahu"), null, { timeout });
  async function mv(p, other, m, end) {
    await myTurn(p);
    const f = F(p);
    if (m[0] === "m") { await f.locator(`#board .cell[data-i="${parseInt(m[1], 12)}"]`).click(); await f.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click(); }
    else { await f.locator(`#seatBot .hp[data-t="${m[1]}"]`).first().click(); await f.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click(); }
    if (end) await F(other).waitForSelector("#endBox:not([hidden])", { timeout: T }); else await myTurn(other);
  }
  // odehraje řadu tahů; první táhne `first`
  const playLine = async (line, first, second) => { for (const [k, m] of line.entries()) await (k % 2 === 0 ? mv(first, second, m, k === line.length - 1) : mv(second, first, m, k === line.length - 1)); };
  // `x` = zakladatel dokumentu; stránka podle toho, kdo za něj hraje
  const pageOf = (who, px, po) => who === "x" ? px : po;

  // ================= scénář 1: Mark = sedadlo 0 zakládá (desktop), Radka = sedadlo 1 čeká (iPhone) =================
  {
    const r = rid(), names = ["Mark", "Radka"];
    await enter(B, hash(r, 1, names, 0));
    check("Radka (zaklada=0): čeká „až hra naskočí“, žádný úvod ani výzva", await frameReady(B, "#info:not([hidden])") && /až hra naskočí/.test(await F(B).locator("#infoTitle").innerText()) && await F(B).locator("#setup").isHidden() && await F(B).locator("#intro").isHidden());
    check("čekající: žádné „Založit novou hru“ ani „Zkusit sám“", await F(B).locator("#infoNew").isHidden() && !(await F(B).locator("#soloBtn").isVisible()));
    await sleep(1500);
    check("čekající nic nezakládá (dokument ještě není)", (await docOf(r)) === null);
    await enter(A, hash(r, 0, names, 1));
    check("Mark (zaklada=1): hra naskočí rovnou bez setupu a bez sdílení", await frameReady(A, "#game:not([hidden])") && await F(A).locator("#setup").isHidden() && await F(A).locator("#share").isHidden() && await F(A).locator("#intro").isHidden());
    check("Radka: hra naskočí sama, bez „Přijmout výzvu“", await frameReady(B, "#game:not([hidden])") && await F(B).locator("#intro").isHidden());
    const d = await docOf(r);
    check("dokument založený rovnou se jmény, 1. kolo Klasika, bez sázky, oba sedí", d && d.g.x === "Mark" && d.g.o === "Radka" && d.g.vr === "k" && d.g.n === 1 && d.g.k === "" && d.hs === 0 && !!d.sx && !!d.so && d.sx !== d.so, JSON.stringify(d && { x: d.g.x, o: d.g.o, vr: d.g.vr, hs: d.hs }));
    await sleep(600);
    check("jména: Mark dole na desktopu, Radka dole na iPhonu", (await F(A).locator("#seatBot .nm").innerText()) === "Mark" && (await F(B).locator("#seatBot .nm").innerText()) === "Radka");
    const hidden = async p => { const f = F(p); return { solo: await f.locator("#soloBtn").isVisible(), fs: await f.locator("#fsBtn").isVisible(), cls: await f.evaluate(() => document.documentElement.classList.contains("herna")) }; };
    const ha = await hidden(A), hb = await hidden(B);
    check("skryté: „Zkusit sám“, celá obrazovka; třída herna", !ha.solo && !hb.solo && !ha.fs && !hb.fs && ha.cls && hb.cls, JSON.stringify([ha, hb]));
    await F(A).evaluate(() => document.getElementById("home").click());
    await sleep(300);
    check("logo v hlavičce nevede ven (zůstává ve hře)", await F(A).locator("#game").isVisible() && (await F(A).evaluate(() => location.hash)).startsWith("#herna=1"));
    await F(A).locator("#menuBtn").click();
    check("nabídka: bez „Zkopírovat odkaz“ a „Založit novou hru“, zbývá nápověda a vzdát", await F(A).locator("#mCopy").isHidden() && await F(A).locator("#mNew").isHidden() && await F(A).locator("#mHelp").isVisible() && await F(A).locator("#mResign").isVisible());
    await F(A).locator("#menuSheet [data-close]").click();
    const ma = await msgs(A), mb = await msgs(B);
    check("rodič dostal `pripraveno` od obou", ma.filter(z => z.typ === "pripraveno").length >= 1 && mb.filter(z => z.typ === "pripraveno").length >= 1 && [...ma, ...mb].every(z => z.herna === 1));
    const pa = await phases(A), pb = await phases(B);
    check("stav: ceka → hraje (Mark i Radka), zatím žádný konec", pa[0] === "ceka" && pa.at(-1) === "hraje" && !pa.includes("konec") && pb[0] === "ceka" && pb.at(-1) === "hraje" && !pb.includes("konec"), JSON.stringify([pa, pb]));
    const fits = async p => F(p).evaluate(() => { const q = s => document.querySelector(s).getBoundingClientRect(); return { ok: scrollY === 0 && q("#seatTop").top >= 0 && q("#seatBot").bottom <= innerHeight && q("#status").bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth, bot: Math.round(q("#seatBot").bottom), st: Math.round(q("#status").bottom), ih: innerHeight }; });
    const fa = await fits(A), fb = await fits(B);
    check("rozvržení v rámu (pod 48px lištou Herny) bez posouvání: desktop i iPhone", fa.ok && fb.ok, JSON.stringify([fa, fb]));
    await A.screenshot({ path: path.join(SHOTS, "herna-hra-desktop.png") }); await B.screenshot({ path: path.join(SHOTS, "herna-hra-iphone.png") });

    // partie 1: vyhrává „o“ = Radka (sedadlo 1)
    let starter = d.g.s;
    await playLine(H.winLine("k", starter, "o"), pageOf(starter, A, B), pageOf(starter === "x" ? "o" : "x", A, B));
    await sleep(2500);
    for (const [n, p] of [["Mark", A], ["Radka", B]]) {
      const rs = await results(p);
      check(`partie 1 (${n}): jeden \`vysledek\` ${r}:1, vítěz je sedadlo 1 (Radka)`, rs.length === 1 && rs[0].partie === `${r}:1` && rs[0].vitez === 1, JSON.stringify(rs));
      check(`partie 1 (${n}): stav konec`, (await phases(p)).at(-1) === "konec");
    }
    await A.screenshot({ path: path.join(SHOTS, "herna-konec-desktop.png") }); await B.screenshot({ path: path.join(SHOTS, "herna-konec-iphone.png") });
    check("konec: tlačítko „Jiná hra“, žádné kopírování odkazu", await F(A).locator("#endOther").isVisible() && (await F(A).locator("#endOther").innerText()) === "Jiná hra" && await F(A).locator("#endSecondary").isHidden() && await F(B).locator("#endOther").isVisible());
    await F(A).locator("#endOther").click();
    await sleep(300);
    check("„Jiná hra“ pošle `jina-hra` rodiči", (await msgs(A)).some(z => z.typ === "jina-hra") && !(await msgs(B)).some(z => z.typ === "jina-hra"));

    // odveta: poražený (Mark = x) zakládá, kolo 2; vyhrává x = Mark (sedadlo 0)
    await F(A).locator("#endPrimary").click();
    await myTurn(A);
    let d2 = await docOf(r);
    check("odveta uvnitř Herny funguje (kolo 2, začíná poražený)", d2.g.n === 2 && d2.g.s === "x", JSON.stringify({ n: d2.g.n, s: d2.g.s }));
    await F(B).waitForFunction(() => document.getElementById("endBox").hidden, null, { timeout: T });
    await playLine(H.winLine(d2.g.vr, "x", "x"), A, B);
    await sleep(2500);
    for (const [n, p] of [["Mark", A], ["Radka", B]]) {
      const rs = (await results(p)).filter(z => z.partie === `${r}:2`);
      check(`partie 2 (${n}): jeden \`vysledek\` ${r}:2, vítěz je sedadlo 0 (Mark)`, rs.length === 1 && rs[0].vitez === 0, JSON.stringify(rs));
    }
    const ph = await phases(A);
    check("stav mezi partiemi: hraje → konec → hraje → konec", ph.join().endsWith("hraje,konec,hraje,konec"), ph.join());

    // kolo 3: remíza opakováním pozice, poražený (Radka = o) zakládá; vitez = null
    await F(B).locator("#endPrimary").click();
    await myTurn(B);
    const d3 = await docOf(r);
    await F(A).waitForFunction(() => document.getElementById("endBox").hidden, null, { timeout: T });
    const loop = H.loopLine(d3.g.vr, d3.g.s);
    await playLine([...loop, ...loop], pageOf(d3.g.s, A, B), pageOf(d3.g.s === "x" ? "o" : "x", A, B));
    await sleep(2500);
    for (const [n, p] of [["Mark", A], ["Radka", B]]) {
      const rs = (await results(p)).filter(z => z.partie === `${r}:3`);
      check(`partie 3 (${n}): remíza → \`vysledek\` s vitez null`, rs.length === 1 && rs[0].vitez === null, JSON.stringify(rs));
    }

    // obnovení stránky po konci partie: stejná partie, stejné `partie` (Herna ji započítá jen jednou)
    await B.reload({ waitUntil: "load" });
    check("obnovení iPhonu: hra se vrátí do rozehrané (skončené) partie bez výzvy a nadále je Radka", await frameReady(B, "#game:not([hidden])") && (await F(B).locator("#seatBot .nm").innerText()) === "Radka" && await F(B).locator("#intro").isHidden());
    await sleep(2500);
    const rs3 = (await results(B)).filter(z => z.partie === `${r}:3`);
    check("po obnovení stejný klíč partie `r:3`", rs3.length === 1 && rs3[0].vitez === null, JSON.stringify(rs3));
    check("žádné nové dokumenty a sedadla zůstala (so beze změny)", (await docOf(r)).so === d.so && (await docOf(r)).sx === d.sx);
  }

  // ================= scénář 2: opačně – Radka (sedadlo 1) zakládá, Mark (sedadlo 0) se připojí; jména se speciálními znaky =================
  {
    const r = rid(), names = ["Řehoř, &%1", "Žofie"];    // sedadlo 0 = „Řehoř, &%1“ (desktop), sedadlo 1 = „Žofie“ (iPhone, zakladatel)
    await enter(A, hash(r, 0, names, 0));
    await enter(B, hash(r, 1, names, 1));
    check("sc.2: obě okna ve hře bez výzvy (zakladatel je sedadlo 1)", await frameReady(A, "#game:not([hidden])") && await frameReady(B, "#game:not([hidden])"));
    await sleep(500);
    const d = await docOf(r);
    check("sc.2: dokument hs = 1, x = zakladatel (Žofie), o = Řehoř, jména se speciálními znaky celá", d && d.hs === 1 && d.g.x === "Žofie" && d.g.o === "Řehoř, &%1", JSON.stringify(d && { hs: d.hs, x: d.g.x, o: d.g.o }));
    check("sc.2: Mark dole „Řehoř, &%1“, Radka dole „Žofie“", (await F(A).locator("#seatBot .nm").innerText()) === "Řehoř, &%1" && (await F(B).locator("#seatBot .nm").innerText()) === "Žofie");
    const starter = d.g.s;
    // vyhrává x = Žofie = sedadlo 1 → vitez 1 (ne 0)
    await playLine(H.winLine("k", starter, "x"), pageOf(starter, B, A), pageOf(starter === "x" ? "o" : "x", B, A));
    await sleep(2500);
    for (const [n, p] of [["Řehoř", A], ["Žofie", B]]) {
      const rs = await results(p);
      check(`sc.2 (${n}): \`vysledek\` ${r}:1 s vitez 1 (sedadlo Žofie, i když je to „x“)`, rs.length === 1 && rs[0].partie === `${r}:1` && rs[0].vitez === 1, JSON.stringify(rs));
    }
    await A.screenshot({ path: path.join(SHOTS, "herna-sc2-konec-desktop.png") });
  }

  // ================= scénář 2b: zakladatel je první a čeká, než se druhý připojí (nesmí táhnout, ani když začíná) =================
  {
    const r = rid(), names = ["Mark", "Radka"];
    await enter(A, hash(r, 0, names, 1));
    check("sc.2b: zakladatel naskočil sám a čeká na soupeře (fáze ceka, text „Čeká se na soupeře“)", await frameReady(A, "#game:not([hidden])") && /Čeká se na soupeře/.test(await F(A).locator("#status").innerText()), await F(A).locator("#status").innerText());
    await sleep(500);
    const d0 = await docOf(r);
    const cells = await F(A).locator("#board .cell").count();
    for (let i = 0; i < cells; i++) await F(A).locator(`#board .cell[data-i="${i}"]`).click({ force: true, timeout: 2000 }).catch(() => {});
    await sleep(400);
    const d1 = await docOf(r);
    check("sc.2b: zakladatel před příchodem soupeře nic nezapíše (zatím jen on sedí)", d1.g.m.length === 0 && !!d1.sx && !d1.so && JSON.stringify((await phases(A)).slice(-1)) === '["ceka"]', JSON.stringify([d1.g.m, (await phases(A))]));
    await sleep(2500);
    await enter(B, hash(r, 1, names, 0));
    check("sc.2b: po příchodu soupeře naskočí hra u obou, fáze hraje", await frameReady(B, "#game:not([hidden])") && (await F(A).waitForFunction(() => !/Čeká se na soupeře/.test(document.getElementById("status").textContent), null, { timeout: T }).then(() => true, () => false)));
    await sleep(500);
    check("sc.2b: oba sedí a fáze je hraje", (await phases(A)).at(-1) === "hraje" && (await phases(B)).at(-1) === "hraje" && !!(await docOf(r)).so);
  }

  // ================= scénář 3: bez platného herna=1 se hra chová postaru =================
  {
    for (const [popis, h] of [["bez hashe", ""], ["herna=1 bez platného r", "#herna=1&m=test000000&r=x&seat=0&names=A,B&zaklada=1"], ["herna=0", "#herna=0&r=abcdef123456&seat=0&names=A,B&zaklada=1"]]) {
      await enter(A, h);
      const ok = await frameReady(A, "#setup:not([hidden])");
      const f = F(A);
      await sleep(400);
      check(`${popis}: úvod s výzvou, „Zkusit sám“ vidět, žádná třída herna, rodič nedostal nic`, ok && await f.locator("#soloBtn").isVisible() && await f.locator("#setupSubmit").isVisible() && !(await f.evaluate(() => document.documentElement.classList.contains("herna"))) && (await msgs(A)).length === 0, JSON.stringify(await msgs(A)));
    }
    await enter(A, "#solo");
    check("#solo uvnitř rámu pořád běží jako sólo (a nehlásí nic Herně)", await frameReady(A, "#game:not([hidden])") && /Trénink/.test(await F(A).locator("#kolo").innerText()) && (await msgs(A)).length === 0);
  }

  await bA.close(); await bB.close();
  check("žádné chyby JavaScriptu", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\nCelkem: ${pass} PASS, ${fail} FAIL (síť: ${FAKE ? "falešná" : "skutečná mantledb.sh"})`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CHYBA TESTU", e); process.exit(2); });
