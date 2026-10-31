// Sólo režim („Zkusit sám“, adresa #solo): celé partie proti botovi v Chromiu desktop 1280×800 a ve WebKitu s devices["iPhone 13"].
// Ověřuje: štítek Trénink, bot táhne sám s pauzou, tah zpět při bot-pauze, konec partie s „Znovu“ a „Vyzvat soupeře“, nové kolo (jiná varianta,
// střídá se začátek), nulový síťový požadavek na mantledb.sh (ani při focus/visibilitychange), žádné tituly/série/úložiště místností,
// rozvržení na iPhonu bez posouvání (obě zásoby i deska; úvod: „Zkusit sám“ vidět bez rolování na 390×664 a 375×667), kontrast textů (světlý i tmavý režim), chyby JavaScriptu.
// node tests/solo.cjs [URL]   (výchozí http://127.0.0.1:8805/)   snímky: tests/shots/solo/ (proměnná SHOTS)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const S = require("../engine.js");
const audit = require("./kontrast.cjs");
const URL = process.argv[2] || "http://127.0.0.1:8805/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots", "solo");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const log = [];
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`;
  log.push(line); console.log(line);
}
const T = 25000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE = { lev: "L", "žirafa": "G", slon: "E", "kuřátko": "C", slepice: "H" };

// stav hry přečtený z DOM (popisky polí a zásoby), hráč je vždy „x“ dole
const readState = p => p.evaluate(TYPE => {
  const b = new Array(12).fill(null);
  document.querySelectorAll("#board .cell").forEach(c => {
    const m = /, (tvoje|soupeřova) ([^,]+)/.exec(c.getAttribute("aria-label") || "");
    if (m) b[+c.dataset.i] = { t: TYPE[m[2]], p: m[1] === "tvoje" ? "x" : "o" };
  });
  const h = { x: [], o: [] };
  for (const [pl, sel] of [["x", "#seatBot"], ["o", "#seatTop"]]) document.querySelectorAll(sel + " .hp[data-t]").forEach(e => { for (let k = 0; k < +e.dataset.n; k++) h[pl].push({ t: e.dataset.t }); });
  return { b, h, turn: "x" };
}, TYPE);
const sameBoard = (a, b) => JSON.stringify(a.b.map(c => c && c.t + c.p)) === JSON.stringify(b.b.map(c => c && c.t + c.p)) &&
  JSON.stringify(["x", "o"].map(p => a.h[p].map(c => c.t).sort())) === JSON.stringify(["x", "o"].map(p => b.h[p].map(c => c.t).sort()));

const fits = p => p.evaluate(() => {
  const r = s => document.querySelector(s).getBoundingClientRect();
  const small = [...document.querySelectorAll("#board .cell, .hp, .iconbtn")].filter(e => e.offsetWidth).filter(e => { const b = e.getBoundingClientRect(); return b.width < 43.5 || b.height < 43.5; }).length;
  return { ok: scrollY === 0 && r("#seatTop").top >= 0 && r("#board").top >= r("#seatTop").bottom - 1 && r("#seatBot").bottom <= innerHeight && r("#status").bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth, small, sy: Math.round(scrollY), bot: Math.round(r("#seatBot").bottom), st: Math.round(r("#status").bottom), ih: innerHeight };
});

async function run(label, launcher, ctxOpts, entry, rounds) {
  const L = (n, ok, extra) => check(`${label} / ${entry}: ${n}`, ok, extra);
  const browser = await launcher.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const mobile = !!ctxOpts.isMobile;
  const errs = [], reqs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|fonts\./.test(m.text())) errs.push("console: " + m.text()); });
  ctx.on("request", r => { if (/mantledb/i.test(r.url())) reqs.push(r.method() + " " + r.url()); });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}-${mobile ? "iphone" : "desktop"}.png`) });
  const settled = () => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === "running"), null, { timeout: T });
  const aud = async n => { await settled(); await sleep(700); const f = await page.evaluate(`(${audit.toString()})()`); L(`${n}: kontrast textů ≥ 4,5:1 (velké 3:1)`, f.length === 0, f.slice(0, 2).join(" | ")); };
  const turnOrEnd = () => page.waitForFunction(() => document.title.startsWith("Jsi na tahu") || !document.getElementById("hanko").hidden, null, { timeout: T });
  const cell = i => page.locator(`#board .cell[data-i="${i}"]`);

  // ---------- vstup ----------
  if (entry === "tlačítko") {
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForSelector("#setup:not([hidden])");
    const btn = page.locator("#soloBtn");
    L("úvod: tlačítko „Zkusit sám“ je vidět, sekundární (quiet) a ≥ 44 px", await btn.isVisible() && /\bquiet\b/.test(await btn.getAttribute("class")) && (await btn.boundingBox()).height >= 43.5);
    L("úvod: hlavní výzva „Založit hru“ zůstává primární a je nad „Zkusit sám“", await page.locator("#setupSubmit.primary").isVisible() && (await page.locator("#setupSubmit").boundingBox()).y < (await btn.boundingBox()).y);
    await shot("uvod");
    if (!mobile) await aud("úvod, světlý");
    await btn.click();
  } else {
    await page.goto(URL + "#solo", { waitUntil: "load" });
  }
  await page.waitForSelector("#game:not([hidden])", { timeout: T });
  L("adresa zůstává #solo", /#solo$/.test(page.url()));

  // ---------- začátek hry ----------
  const kolo = () => page.locator("#kolo").innerText();
  const isLayoutOk = async n => { const f = await fits(page); L(n, f.ok && f.small === 0, JSON.stringify(f)); };
  L("štítek „Trénink · Kolo 1 · Klasika“", (await kolo()) === "Trénink · Kolo 1 · Klasika", await kolo());
  const st0 = await readState(page);
  L("start: klasické rozestavení a obě zásoby prázdné", sameBoard(st0, S.initial("x", "k")) && st0.h.x.length === 0 && st0.h.o.length === 0);
  L("jména: hráč „Ty“ dole, soupeř „Bot“ nahoře", (await page.locator("#seatBot .nm").innerText()) === "Ty" && (await page.locator("#seatTop .nm").innerText()) === "Bot");
  L("hlavička bez skóre a sázky", (await page.locator("#score").innerText()).trim() === "");
  L("nic ze sdílení: žádné „Zkopírovat odkaz“, přihlížení ani Kdo začíná", await page.locator("#waitCopy").isHidden() && await page.locator("#claims").isHidden() && await page.locator("#starterSeg").isHidden() && await page.locator("#stakeSel").isHidden());
  await page.click("#menuBtn");
  L("nabídka: bez „Zkopírovat odkaz“, s „Vzdát partii“", await page.locator("#mCopy").isHidden() && await page.locator("#mResign").isVisible());
  await page.keyboard.press("Escape");
  L("hlavní zobrazení: jen bot, žádné tituly (disc.lak) ani razítko", await page.locator(".disc.lak").count() === 0 && await page.locator("#hanko").isHidden());
  if (mobile) await isLayoutOk("iPhone: celá deska i obě zásoby bez posouvání na startu");
  else await shot("hra-start");
  // focus a viditelnost nesmí vyvolat dotaz na síť
  await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("online")); });
  await sleep(400);
  L("focus / visibilitychange / online nevyvolají síť", reqs.length === 0, reqs.join(" | "));

  // ---------- „Vzít tah zpět“ v sólu není (bot odpovídá za ~0,8 s, tlačítko by jen blikalo a posouvalo rozvržení) ----------
  if (entry === "hash") {
    const mv = S.moves(st0).find(m => m.k === "m");
    await cell(mv.f).click(); await cell(mv.to).click();
    L("po tahu: bot přemýšlí a tlačítko „Vzít tah zpět“ se neukazuje", (await page.locator("#status").innerText()).includes("Bot přemýšlí") && await page.locator("#undoBtn").isHidden());
    await turnOrEnd();
  }

  // ---------- partie ----------
  let lastBotDt = [], plies = 0, layoutBad = 0, botMoves = 0;
  async function playOut(roundNo) {
    let myMoves = 0;
    for (;;) {
      await turnOrEnd();
      if (await page.locator("#hanko:not([hidden])").count()) break;
      const s = await readState(page);
      if (mobile && !(await fits(page)).ok) layoutBad++;
      if (roundNo === 1 && myMoves === 3) { await sleep(1100); await shot("hra"); }
      // reálný tah bota je vidět v textu „Bot: …“ (od druhého tahu, nebo hned když bot začínal)
      if (myMoves > 0 || roundNo % 2 === 0) { const sub = await page.locator("#sub").innerText(); if (/^Bot: /.test(sub)) botMoves++; }
      let mv;
      if (myMoves > 100) { // pojistka proti nekonečné partii: vzdát se z nabídky
        page.once("dialog", d => d.accept());
        await page.click("#menuBtn"); await page.click("#mResign");
        break;
      }
      const legal = S.moves(s);
      mv = Math.random() < 0.2 ? legal[Math.floor(Math.random() * legal.length)] : S.bot(s);
      if (mv.k === "m") { await cell(mv.f).click(); await cell(mv.to).click(); }
      else { await page.locator(`#seatBot .hp[data-t="${mv.t}"]`).first().click(); await cell(mv.to).click(); }
      myMoves++; plies++;
      const t0 = Date.now();
      await turnOrEnd();
      if (!(await page.locator("#hanko:not([hidden])").count())) lastBotDt.push(Date.now() - t0);
    }
    await page.waitForSelector("#endBox:not([hidden])", { timeout: T });
    return myMoves;
  }

  for (let round = 1; round <= rounds; round++) {
    if (round > 1) {
      // nové kolo: jiná varianta, začíná bot (střídá se)
      const k = await kolo();
      const mm = /^Trénink · Kolo (\d+) · (.+)$/.exec(k);
      const key = mm && S.VR_KEYS.find(v => S.VARIANTS[v].n === mm[2]);
      L(`kolo ${round}: štítek Trénink · Kolo ${round} · jiná varianta než Klasika`, !!mm && +mm[1] === round && !!key && key !== "k", k);
      vrs.push(key);
      const sNow = await readState(page);
      L(`kolo ${round}: rozestavení odpovídá variantě ${key} (bot ještě netáhl nebo táhl první)`, sameBoard(sNow, S.initial("o", key)) || (await page.locator("#sub").innerText()).startsWith("Bot: "));
      L(`kolo ${round}: začíná bot (střídá se)`, !(await page.title()).startsWith("Jsi na tahu") || (await page.locator("#sub").innerText()).startsWith("Bot: "));
    } else vrs.push("k");
    const n = await playOut(round);
    await sleep(200);
    L(`kolo ${round}: partie doběhla do konce (moje tahy ${n})`, await page.locator("#endBox").isVisible());
    // konec partie
    const prim = page.locator("#endPrimary"), sec = page.locator("#endSecondary");
    L(`kolo ${round}: konec: hlavní „Znovu“, sekundární „Vyzvat soupeře“`, await prim.isVisible() && (await prim.innerText()) === "Znovu" && await sec.isVisible() && (await sec.innerText()) === "Vyzvat soupeře" && (await page.locator("#endBox .btn:visible").count()) === 2);
    L(`kolo ${round}: konec bez výběru variant, lístku se sázkou a titulů`, await page.locator("#pick").isHidden() && await page.locator("#pickSeg").isHidden() && await page.locator(".ticket").isHidden() && await page.locator("#tRanks").isHidden() && await page.locator(".disc.lak").count() === 0 && await page.locator("#hanko.sq").count() === 0);
    L(`kolo ${round}: skóre v hlavičce prázdné, endMeta s Trénink`, (await page.locator("#score").innerText()).trim() === "" && (await page.locator("#endMeta").innerText()).startsWith("Trénink · Kolo " + round));
    L(`kolo ${round}: konec: výsledek je napsaný (Vyhráváš / Vyhrává Bot / Remíza)`, /Vyhráváš|Vyhrává Bot|Remíza/.test(await page.locator("#endL2").innerText() + await page.locator("#endL1").innerText()), (await page.locator("#endL1").innerText()) + " | " + (await page.locator("#endL2").innerText()));
    if (round === 1) {
      await settled(); await sleep(400);
      await page.evaluate(() => document.getElementById("endBox").scrollIntoView({ block: "end" }));
      await sleep(250);
      await shot("konec");
      await aud(`konec kola ${round}, světlý`);
      await page.emulateMedia({ colorScheme: "dark" });
      await sleep(900);
      await aud(`konec kola ${round}, tmavý`);
      await shot("konec-tmavy");
      await page.emulateMedia({ colorScheme: "light" });
      await sleep(700);
    }
    if (round < rounds) { await prim.click(); await sleep(120); }
  }

  // ---------- Vyzvat soupeře: pryč ze sóla na úvod ----------
  await page.click("#endSecondary");
  await page.waitForSelector("#setup:not([hidden])", { timeout: T });
  L("„Vyzvat soupeře“: úvodní obrazovka, hra skrytá, #solo pryč z adresy", await page.locator("#game").isHidden() && !/#solo/.test(page.url()) && await page.locator("#setupSubmit").isVisible(), page.url());

  // ---------- souhrn ----------
  const keys = await page.evaluate(() => Object.keys(localStorage));
  L("úložiště: žádná místnost, seznam her ani tituly se nezapsaly", !keys.some(k => /^zs-(rooms|r-|ti-)/.test(k)), keys.join());
  L("bot táhl sám (v textu viděl „Bot: …“) a s pauzou ≥ 600 ms", botMoves >= 1 && lastBotDt.length > 0 && Math.min(...lastBotDt) >= 600, `bot ${botMoves}×, min ${Math.min(...lastBotDt)} ms, median ${[...lastBotDt].sort((a, b) => a - b)[lastBotDt.length >> 1]} ms`);
  if (mobile) L("iPhone: deska i obě zásoby celou partii bez posouvání", layoutBad === 0, layoutBad + "×");
  L("žádný request na mantledb.sh za celou relaci", reqs.length === 0, reqs.slice(0, 3).join(" | "));
  L("žádné chyby JavaScriptu", errs.length === 0, errs.join(" | "));
  await browser.close();
}
// úvodní obrazovka na iPhonu: „Zkusit sám“ i hlavní výzva jsou vidět bez posouvání (390×664 = iPhone 13 v Safari, 375×667), světle i tmavě;
// na vysokém displeji (390×844) zůstává řada zvířátek
async function uvodIphone() {
  const browser = await webkit.launch();
  for (const [w, h] of [[390, 664], [375, 667], [390, 844]]) for (const cs of ["light", "dark"]) {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: w, height: h }, colorScheme: cs });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForSelector("#setup:not([hidden])");
    await sleep(500);
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect(), btn = r("#soloBtn");
      return { soloBottom: Math.round(btn.bottom), noteBottom: Math.round(r("#soloNote").bottom), subBottom: Math.round(r("#setupSubmit").bottom), subTop: Math.round(r("#setupSubmit").top), soloTop: Math.round(btn.top), soloH: Math.round(btn.height), ih: innerHeight, sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, quiet: document.getElementById("soloBtn").classList.contains("quiet"), cast: document.getElementById("setupCast").offsetHeight > 0 };
    });
    const tag = `iPhone ${w}×${h} ${cs === "dark" ? "tmavě" : "světle"}`;
    const tall = h >= 800;
    check(`úvod ${tag}: „Zkusit sám“ (tlačítko i věta pod ním) je celé vidět bez posouvání (bottom ≤ innerHeight)`, m.soloBottom <= m.ih && m.noteBottom <= m.ih, `tlačítko ${m.soloBottom}, věta ${m.noteBottom}, okno ${m.ih}`);
    check(`úvod ${tag}: hlavní výzva „Založit hru“ je celá vidět a nad „Zkusit sám“`, m.subBottom <= m.ih && m.subBottom <= m.soloTop, `výzva ${m.subTop}–${m.subBottom}, sólo od ${m.soloTop}`);
    check(`úvod ${tag}: stránka se nemusí rolovat (scrollHeight ≤ innerHeight, bez vodorovného posouvání)`, m.sh <= m.ih && m.sw <= m.iw, `${m.sh}/${m.ih}, ${m.sw}/${m.iw}`);
    check(`úvod ${tag}: „Zkusit sám“ je tichý (quiet) a cíl ≥ 44 px`, m.quiet && m.soloH >= 43.5, `${m.soloH} px`);
    check(`úvod ${tag}: řada zvířátek ${tall ? "zůstává na vysokém displeji" : "je na nízkém displeji skrytá"}`, m.cast === tall);
    await page.screenshot({ path: path.join(SHOTS, `uvod-iphone-${w}x${h}-${cs}.png`) });
    await ctx.close();
  }
  await browser.close();
}
const vrs = [];

(async () => {
  const profiles = [
    ["chromium desktop 1280×800", chromium, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
    ["webkit iPhone 13", webkit, { ...devices["iPhone 13"] }],
  ];
  await Promise.all(profiles.map(async ([label, launcher, opts]) => {
    await run(label, launcher, opts, "tlačítko", 2);
    await run(label, launcher, opts, "hash", 1);
  }));
  await uvodIphone();
  console.log(`\n${pass} prošlo, ${fail} selhalo`);
  fs.writeFileSync(path.join(SHOTS, "vysledek.txt"), log.join("\n") + `\n${pass} prošlo, ${fail} selhalo\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
