// Živá Herna (skutečný rozcestník na GitHub Pages) + živá hra: Mark (Chromium desktop 1440×900) založí místnost, Radka (WebKit iPhone 13) vstoupí,
// Mark vybere Zvířátkové šógi, hra naskočí oběma bez výzvy, odehraje se partie a výsledek se započítá do skóre v liště Herny, „Jiná hra“ vrací do místnosti.
// Skutečný mantledb.sh, žádné falešné routy. Založí na Herně jednu zkušební místnost (vyprší sama).
// node tests/herna-zive.cjs [URL Herny]   (výchozí https://sachasportrezervace-arch.github.io/herna/)   snímky: tests/shots-live/herna-zive/
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const H = require("./pomocne.cjs");
const URL_ = process.argv[2] || "https://sachasportrezervace-arch.github.io/herna/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots-live", "herna-zive");
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, fail = 0;
const check = (n, c, x = "") => { if (c) ok++; else fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  (" + (typeof x === "string" ? x : JSON.stringify(x)) + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cekej = async (fn, ms = 25000) => { const t = Date.now() + ms; while (Date.now() < t) { if (await fn().catch(() => false)) return true; await sleep(250); } return false; };
const T = 25000;

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const errs = [];
  const mk = async (b, o, tag) => { const ctx = await b.newContext(o), page = await ctx.newPage(); page.on("pageerror", e => errs.push(tag + ": " + e.message)); return page; };
  const a = await mk(bA, { viewport: { width: 1440, height: 900 } }, "Mark"), b = await mk(bB, { ...devices["iPhone 13"] }, "Radka");
  const fr = p => p.frames().find(f => f !== p.mainFrame());
  const src = p => p.$eval("#ram-telo iframe", f => f.src).catch(() => "");
  const skore = p => p.textContent("#ram-skore").then(t => t.replace(/\s/g, "")).catch(() => "");

  await a.goto(URL_, { waitUntil: "networkidle" });
  await a.click("#pas-zalozit");
  await a.fill('input[name="ja"]', "Mark"); await a.fill('input[name="on"]', "Radka");
  await a.click('#dlg-form [type="submit"]');
  await a.waitForURL(/#m=[0-9a-z]{10}$/, { timeout: 15000 });
  const odkaz = a.url();
  await a.click('#dlg [data-dlg-zavri].tl');
  await b.goto(odkaz, { waitUntil: "networkidle" });
  await b.waitForSelector('#dlg:not([hidden]) [data-akce="vstoupit"]');
  await b.click('[data-akce="vstoupit"]');
  await b.waitForFunction(() => document.getElementById("sk-j1").classList.contains("je-ja"), null, { timeout: 15000 });
  check("místnost: Mark a Radka sedí", await cekej(async () => /Hrajete spolu/.test(await a.textContent("#mist-stav"))));

  await a.click('.hra[data-id="zviratka-sogi"] .hra-odkaz');
  check("Mark: adresa hry s herna=1, seat=0, zaklada=1", await cekej(async () => /#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10}k\d+&seat=0&names=Mark,Radka&zaklada=1$/.test(await src(a))), await src(a));
  check("Radka: hra se přepne sama (seat=1, zaklada=0)", await cekej(async () => /seat=1&names=Mark,Radka&zaklada=0$/.test(await src(b))), await src(b));
  const r = /r=([0-9a-z]+)&/.exec(await src(a))[1];
  check("Herna poznala protokol (hra v rámu bez starého předávání výzvy)", /herna=1/.test(await src(a)));
  check("hra naskočí u obou bez úvodu, výzvy a setupu", await cekej(async () => {
    const fa = fr(a), fb = fr(b);
    return await fa.locator("#game").isVisible() && await fb.locator("#game").isVisible() && await fa.locator("#setup").isHidden() && await fb.locator("#intro").isHidden();
  }));
  await sleep(1500);
  check("jména dole: Mark / Radka", (await fr(a).locator("#seatBot .nm").innerText()) === "Mark" && (await fr(b).locator("#seatBot .nm").innerText()) === "Radka");
  check("skryto: Zkusit sám, sdílení", !(await fr(a).locator("#soloBtn").isVisible()) && await fr(a).locator("#share").isHidden());
  await a.screenshot({ path: path.join(SHOTS, "zive-hra-desktop.png") }); await b.screenshot({ path: path.join(SHOTS, "zive-hra-iphone.png") });
  const d = await (await fetch(`https://mantledb.sh/v2/zviratka-${r}/hra`, { cache: "no-store" })).json();
  check("dokument hry na mantledb: jména, hs 0, oba sedí", d.g.x === "Mark" && d.g.o === "Radka" && d.hs === 0 && !!d.sx && !!d.so, JSON.stringify({ x: d.g.x, o: d.g.o, hs: d.hs }));

  // vyhraje Radka (o) → skóre 0 : 1
  const myTurn = p => fr(p).waitForFunction(() => document.title.startsWith("Jsi na tahu"), null, { timeout: T });
  async function mv(p, other, m, end) {
    await myTurn(p);
    const f = fr(p);
    if (m[0] === "m") { await f.locator(`#board .cell[data-i="${parseInt(m[1], 12)}"]`).click(); await f.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click(); }
    else { await f.locator(`#seatBot .hp[data-t="${m[1]}"]`).first().click(); await f.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click(); }
    if (end) await fr(other).waitForSelector("#endBox:not([hidden])", { timeout: T }); else await myTurn(other);
  }
  const line = H.winLine("k", d.g.s, "o"), first = d.g.s === "x" ? a : b, second = d.g.s === "x" ? b : a;
  for (const [k, m] of line.entries()) await (k % 2 === 0 ? mv(first, second, m, k === line.length - 1) : mv(second, first, m, k === line.length - 1));
  check("výsledek se započítá do lišty Herny u obou: Mark 0 : 1 Radka", await cekej(async () => (await skore(a)) === "Mark0:1Radka" && (await skore(b)) === "Mark0:1Radka"), [await skore(a), await skore(b)]);
  await sleep(7000);
  const hd = await (await fetch(`https://mantledb.sh/v2/herna-${/#m=([0-9a-z]{10})/.exec(odkaz)[1]}/mistnost`, { cache: "no-store" })).json();
  check("skóre v dokumentu Herny započteno jednou (sk 0,1, 1 záznam)", hd.g.sk.join() === "0,1" && hd.g.log.length === 1 && hd.g.log[0].w === 1 && hd.g.log[0].g === "zviratka-sogi", JSON.stringify(hd.g));
  await a.screenshot({ path: path.join(SHOTS, "zive-konec-desktop.png") }); await b.screenshot({ path: path.join(SHOTS, "zive-konec-iphone.png") });
  await fr(a).locator("#endOther").click();
  check("„Jiná hra“ vrátí Marka do místnosti Herny", await cekej(async () => !(await a.$eval("#ram", e => !e.hidden).catch(() => false))));
  await bA.close(); await bB.close();
  check("žádné chyby JavaScriptu", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\nCelkem: ${ok} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CHYBA TESTU", e); process.exit(2); });
