// Desktop (Chromium 1280×800, Mark) proti iPhonu (WebKit, devices["iPhone 13"] na výšku, Radka): celá série partií,
// k tomu měření rozvržení, fullscreen, „Přidat na plochu“, manifest, aplikace z plochy, tmavý režim a kontrast.
// node tests/desktop-iphone.cjs [URL]   (výchozí http://127.0.0.1:8791/)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const audit = require("./kontrast.cjs");
const URL = process.argv[2] || "http://127.0.0.1:8791/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const log = [];
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`;
  log.push(line); console.log(line);
}
const T = 15000;
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + ".png") });

// ---------- měření rozvržení ----------
const measure = p => p.evaluate(() => {
  const R = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; };
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden],dialog:not([open])"); };
  const smallest = sel => [...document.querySelectorAll(sel)].filter(vis).map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, what: (e.id || e.className || e.tagName) + "" }; });
  const small = [];
  for (const [sel, minW, minH] of [["#board .cell", 44, 44], [".hp", 44, 44], [".iconbtn", 44, 44], [".btn", 0, 44]])
    for (const s of smallest(sel)) if (s.w < minW - .5 || s.h < minH - .5) small.push(`${sel} ${Math.round(s.w)}×${Math.round(s.h)}`);
  return {
    ih: innerHeight, iw: innerWidth, sw: document.documentElement.scrollWidth, scrollY, small,
    hdr: R("header.top"), top: R("#seatTop"), stage: R("#stage"), bot: R("#seatBot"), status: R("#status"), rules: R(".aside-play"),
    rulesVisible: !!document.querySelector(".aside-play") && vis(document.querySelector(".aside-play")),
  };
});
function layoutChecks(label, m, { desktop = false, minBoardW = 0 } = {}) {
  check(`${label}: žádné vodorovné posouvání`, m.sw <= m.iw, `scrollWidth ${m.sw} ≤ innerWidth ${m.iw}`);
  check(`${label}: hlavička, obě zásoby i celá deska bez posouvání`,
    m.scrollY === 0 && m.hdr.top >= 0 && m.top.top >= m.hdr.bottom - 1 && m.stage.top >= m.top.bottom - 1 && m.bot.top >= m.stage.bottom - 1 && m.bot.bottom <= m.ih,
    `#seatTop ${m.top.top}–${m.top.bottom}, #stage ${m.stage.top}–${m.stage.bottom} (šířka ${m.stage.w}), #seatBot bottom ${m.bot.bottom} / innerHeight ${m.ih}`);
  check(`${label}: nadpis stavu je vidět`, m.status && m.status.bottom <= m.ih, `#status bottom ${m.status && m.status.bottom} / ${m.ih}`);
  check(`${label}: dotykové cíle aspoň 44×44`, m.small.length === 0, [...new Set(m.small)].slice(0, 4).join(", "));
  if (desktop) {
    check(`${label}: deska větší než na mobilu`, m.stage.w > minBoardW, `${m.stage.w} px > ${minBoardW} px`);
    check(`${label}: pravidla jsou v pravém sloupci`, m.rulesVisible && m.rules.left >= m.stage.right, m.rules ? `pravidla od ${m.rules.left}, deska končí ${m.stage.right}` : "chybí");
  } else {
    check(`${label}: pravidla v postranním sloupci se na mobilu neukazují`, !m.rulesVisible);
  }
}

// ---------- mock mantledb (jen pro rychlé stavy rozvržení a tmavého režimu) ----------
const MOVES = ["m74", "m24", "dC5", "m03", "m52", "m36"], END = [...MOVES, "m21"];
const doc = (m, so = "do") => JSON.stringify({ app: "zviratka", v: 5, sx: "dx", so, g: { x: "Mark", o: "Radka", s: "x", m, t: null, k: "1", kc: "", w: [1, 0], r: "" } });
async function mockPage(ctx, init) {
  const store = {}, page = await ctx.newPage();
  await page.route("https://mantledb.sh/**", route => {
    const r = route.request(), u = r.url();
    if (r.method() === "GET") return route.fulfill(store[u] ? { status: 200, contentType: "application/json", body: store[u] } : { status: 404, body: "" });
    if (r.method() === "POST") { store[u] = r.postData(); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    route.continue();
  });
  if (init) await page.addInitScript(init);
  const key = id => `https://mantledb.sh/v2/zviratka-${id}/hra`;
  return { page, put: (id, d) => { store[key(id)] = d; } };
}

(async () => {
  const bA = await chromium.launch({ args: ["--enable-features=OverlayScrollbar"] }), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) p.on("pageerror", e => errs.push(n + ": " + e.message));
  // počítadlo volání Fullscreen API (kdyby headless Chromium celou obrazovku neumělo)
  await A.addInitScript(() => {
    window.__fs = { req: 0, exit: 0 };
    const rq = Element.prototype.requestFullscreen; Element.prototype.requestFullscreen = function (...a) { window.__fs.req++; return rq.apply(this, a); };
    const ex = Document.prototype.exitFullscreen; Document.prototype.exitFullscreen = function (...a) { window.__fs.exit++; return ex.apply(this, a); };
  });

  const myTurn = (p, timeout = T) => p.waitForFunction(() => document.title.startsWith("Jsi na tahu"), null, { timeout });
  const text = (p, sel) => p.locator(sel).first().innerText();
  const label = (p, i) => p.locator(`#board .cell[data-i="${i}"]`).getAttribute("aria-label");
  async function mv(p, other, m, { end = false } = {}) {
    await myTurn(p);
    if (m[0] === "m") {
      await p.locator(`#board .cell[data-i="${parseInt(m[1], 12)}"]`).click();
      await p.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click();
    } else {
      await p.locator(`#seatBot .hp[data-t="${m[1]}"]`).first().click();
      await p.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click();
    }
    if (end) await other.waitForSelector("#endBox:not([hidden])", { timeout: T });
    else await myTurn(other);
  }

  // 0) manifest a ikony (HTTP)
  {
    const base = URL.replace(/#.*$/, "");
    const html = await (await A.request.get(base)).text();
    check("index.html odkazuje na manifest, apple-touch-icon a apple-mobile-web-app-capable",
      /<link rel="manifest" href="manifest\.webmanifest">/.test(html) && /rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/.test(html) && /name="apple-mobile-web-app-capable" content="yes"/.test(html) && /viewport-fit=cover/.test(html));
    const mr = await A.request.get(new globalThis.URL("manifest.webmanifest", base).href);
    let man = null; try { man = await mr.json(); } catch {}
    check("manifest: HTTP 200 a platný JSON", mr.status() === 200 && !!man, `HTTP ${mr.status()}, ${mr.headers()["content-type"] || ""}`);
    check("manifest: display = standalone, název, barvy z tokenů, bez start_url",
      man && man.display === "standalone" && man.name === "Zvířátkové šógi" && !!man.short_name && man.background_color === "#F3EBDD" && man.theme_color === "#F3EBDD" && !("start_url" in man));
    const icons = (man && man.icons) || [];
    check("manifest: ikony 192 a 512 PNG", icons.some(i => i.sizes === "192x192" && i.type === "image/png") && icons.some(i => i.sizes === "512x512" && i.type === "image/png"));
    for (const src of [...new Set([...icons.map(i => i.src), "icons/apple-touch-icon.png"])]) {
      const r = await A.request.get(new globalThis.URL(src, base).href);
      const b = await r.body();
      const png = b.length > 24 && b.readUInt32BE(0) === 0x89504e47;
      check(`ikona ${src}: HTTP 200, PNG ${png ? b.readUInt32BE(16) + "×" + b.readUInt32BE(20) : "?"}`, r.status() === 200 && png);
    }
  }

  // 1) založení výzvy (Mark, desktop)
  await A.goto(URL);
  await A.waitForSelector("#setup:not([hidden])");
  await shot(A, "d-01-zalozeni");

  // fullscreen v Chromiu
  {
    const btn = A.locator("#fsBtn");
    check("fullscreen: tlačítko je vidět, má aria-label a aspoň 44×44", await btn.isVisible() && /obrazovka/i.test(await btn.getAttribute("aria-label")) && (b => b.width >= 44 && b.height >= 44)(await btn.boundingBox()));
    const before = await btn.getAttribute("aria-label");
    await btn.click();
    const inFs = await A.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 4000 }).then(() => true, () => false);
    const calls = await A.evaluate(() => window.__fs.req);
    const after = await btn.getAttribute("aria-label");
    if (inFs) {
      check("fullscreen: document.fullscreenElement se nastaví a popisek se přepne na ukončení", calls === 1 && /Ukončit/.test(after) && before !== after, `volání ${calls}, „${after}“`);
      await btn.click();
      const out = await A.waitForFunction(() => !document.fullscreenElement, null, { timeout: 4000 }).then(() => true, () => false);
      check("fullscreen: druhé klepnutí vrátí fullscreenElement na null a popisek zpět", out && (await btn.getAttribute("aria-label")) === before);
    } else {
      check("fullscreen: headless Chromium celou obrazovku nepřepnul, ověřeno aspoň volání requestFullscreen()", calls === 1, `volání ${calls}; fullscreenElement zůstal null (omezení headless)`);
    }
    await A.waitForTimeout(300);
  }

  await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka");
  await A.selectOption("#stakeSel", "1");
  await A.click('#starterSeg button[data-v="x"]');
  await A.click("#setupSubmit");
  await A.waitForSelector("#share:not([hidden])", { timeout: T });
  const link = await A.evaluate(() => location.href);
  const msg = await A.inputValue("#msg");
  check("výzva: odkaz #r.<id> a zpráva se jménem a sázkou", /#r\.[0-9a-z]{12}$/.test(link) && msg.includes("Mark tě vyzývá") && msg.includes("platí kafe") && msg.includes(link), link);
  await shot(A, "d-02-share");
  await A.click("#backBtn");

  // 2) Radka (iPhone) otevře odkaz a přijme
  await B.goto(link);
  await B.waitForSelector("#intro:not([hidden])", { timeout: T });
  await shot(B, "m-02-vyzva");
  check("výzva u soupeře: jména + sázka", (await text(B, "#introTitle")).includes("Mark tě vyzývá") && (await text(B, "#introStake")).includes("platí kafe"));
  await B.click("#acceptBtn");
  await B.waitForSelector("#game:not([hidden])", { timeout: T });
  check("Radka po přijetí čeká na tah Marka", (await text(B, "#status")).includes("Mark přemýšlí"));
  await myTurn(A);
  check("Mark vidí, že výzva je přijatá a začíná", (await text(A, "#status")).startsWith("Začínáš"));

  // iPhone: tlačítko otevře nápovědu „Přidat na plochu“ (ne fullscreen)
  {
    const btn = B.locator("#fsBtn");
    check("iPhone: tlačítko je vidět, má aria-label a aspoň 44×44", await btn.isVisible() && /plochu/i.test(await btn.getAttribute("aria-label")) && (b => b.width >= 44 && b.height >= 44)(await btn.boundingBox()));
    await btn.click();
    await B.waitForSelector("#installSheet[open]", { timeout: 3000 });
    const t = (await text(B, "#installSheet")).replace(/\s+/g, " ");
    check("iPhone: tlačítko otevře nápovědu „Přidat na plochu“ (Sdílet → Přidat na plochu, odkaz na hru)", /Přidat na plochu/.test(t) && /Sdílet/.test(t) && /odkaz na svou hru/.test(t) && /celou obrazovku/.test(t));
    check("iPhone: místo fullscreenu se nic nepřepnulo", await B.evaluate(() => !document.fullscreenElement && !document.webkitFullscreenElement));
    await shot(B, "m-03-pridat-na-plochu");
    await B.click("#installSheet [data-close]");
    await B.waitForFunction(() => !document.getElementById("installSheet").open);
  }

  // 3) rozvržení, živá partie na obou zařízeních (výchozí pozice)
  await B.waitForTimeout(300);
  const mA0 = await measure(A), mB0 = await measure(B);
  layoutChecks("živá hra, iPhone 13 (390×664)", mB0);
  layoutChecks("živá hra, desktop 1280×800", mA0, { desktop: true, minBoardW: mB0.stage.w });
  await shot(A, "d-03-hra-svetly"); await shot(B, "m-03-hra-svetly");

  // nápověda tahů: výběr žirafy ukáže cíle
  await A.locator('#board .cell[data-i="11"]').click();
  const tg = await A.locator("#board .cell.target").evaluateAll(els => els.map(e => +e.dataset.i).sort((a, b) => a - b));
  check("nápověda: žirafa na C1 smí jen na C2", JSON.stringify(tg) === "[8]", JSON.stringify(tg));
  await A.locator('#board .cell[data-i="11"]').click();

  // 4) PARTIE 1: sebrání, položení, proměna, chycení lva
  await myTurn(A);
  await A.locator('#board .cell[data-i="7"]').click();
  check("nápověda: kuřátko ukazuje sebrání (červený rámeček)", await A.locator('#board .cell[data-i="4"].target.cap').count() === 1);
  await A.locator('#board .cell[data-i="4"]').click();
  const ghostA = await A.waitForSelector("#fx .ghost", { timeout: 2000 }).then(() => true, () => false);
  await A.waitForTimeout(500);
  await shot(A, "d-04-prebehnuti");
  check("sebrání: u Marka (desktop) animace přeběhnutí (figurka letí do zásoby)", ghostA);
  const ghostB = await B.waitForSelector("#fx .ghost", { timeout: T }).then(() => true, () => false);
  check("sebrání: u Radky (iPhone) stejná animace po synchronizaci", ghostB);
  await myTurn(B);
  await A.waitForTimeout(1400);
  check("sebrané kuřátko je v Markově zásobě (modré)", await A.locator('#seatBot .tray .hp[data-t="C"] .own-x').count() === 1);
  check("Radka vidí kuřátko v Markově zásobě", await B.locator('#seatTop .tray .hp[data-t="C"] .own-x').count() === 1);
  // rozvržení se zásobou (tlačítka .hp v zásobě existují)
  await B.waitForTimeout(600);
  const mA1 = await measure(A), mB1 = await measure(B);
  layoutChecks("živá hra se zásobou, iPhone 13", mB1);
  layoutChecks("živá hra se zásobou, desktop 1280×800", mA1, { desktop: true, minBoardW: mB1.stage.w });

  await mv(B, A, "m24");
  await A.waitForTimeout(1400);
  check("Radčin slon sebral kuřátko, je v její zásobě", await B.locator('#seatBot .tray .hp[data-t="C"] .own-o').count() === 1);

  // položení ze zásoby
  await myTurn(A);
  await A.locator('#seatBot .hp[data-t="C"]').first().click();
  const empties = await A.evaluate(() => [...document.querySelectorAll("#board .cell")].filter(c => !c.querySelector(".pc")).length);
  const dropT = await A.locator("#board .cell.target").count();
  check("položení: zvýrazněna všechna volná pole", dropT === empties && dropT > 0, `${dropT}/${empties}`);
  await shot(A, "d-05-zasoba-vyber");
  await A.locator('#board .cell[data-i="5"]').click();
  await myTurn(B);
  check("položení: kuřátko stojí na C3 u obou", (await label(A, 5)).includes("kuřátko") && (await label(B, 5)).includes("kuřátko"));
  check("položení: Markova zásoba je prázdná", (await text(A, "#seatBot .tray")).includes("prázdná"));

  await mv(B, A, "m03");
  await mv(A, B, "m52");
  await A.waitForTimeout(1200);
  check("proměna: kuřátko na poslední řadě je slepice (Mark)", (await label(A, 2)).includes("slepice"));
  check("proměna: Radka vidí slepici", (await label(B, 2)).includes("slepice"));
  await mv(B, A, "m36");
  await mv(A, B, "m21", { end: true });
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await A.waitForTimeout(1800);
  await shot(A, "d-06-vyhra-lev"); await shot(B, "m-06-prohra-lev");
  check("výhra chycením lva (Mark)", (await text(A, "#endL1")).includes("Lev je chycený") && (await text(A, "#endL2")).includes("Vyhráváš"));
  check("prohra u Radky", (await text(B, "#endL1")).includes("Tvůj lev je chycený") && (await text(B, "#endL2")).includes("Vyhrává Mark"));
  check("razítko LEV CHYCEN", (await text(A, "#hanko")).replace(/\s+/g, " ").includes("LEV CHYCEN"));
  check("sázka: Radka platí kafe", (await text(A, "#tRes")).includes("Radka platí kafe") && (await text(B, "#tRes")).includes("Kafe platíš ty"));
  check("série 1 : 0", (await text(A, "#tSer")).includes("Mark 1 : 0 Radka"));
  check("chycený lev je v Markově zásobě", await A.locator('#seatBot .tray [data-id="1"]').count() === 1);
  {
    // Změna chování: na úzkém displeji se stránka po razítku sama doposune, aby byl vidět výsledek a tlačítko odvety
    // (deska se pak částečně posune nahoru), na desktopu zůstává vše na místě.
    await B.waitForTimeout(1500);
    const a = await measure(A), b = await measure(B);
    const btn = p => p.evaluate(() => { const r = document.getElementById("endPrimary").getBoundingClientRect(); return { bottom: Math.round(r.bottom), top: Math.round(r.top), ih: innerHeight }; });
    const ba = await btn(A), bb = await btn(B);
    check("konec partie: desktop má vše na místě a tlačítko odvety vidět, na iPhonu je po razítku vidět výsledek a tlačítko odvety", a.bot.bottom <= a.ih && a.scrollY === 0 && ba.bottom <= ba.ih && bb.top >= 0 && bb.bottom <= bb.ih && a.sw <= a.iw && b.sw <= b.iw, `desktop odveta ${ba.top}–${ba.bottom}/${ba.ih}, iPhone odveta ${bb.top}–${bb.bottom}/${bb.ih}, scrollY ${b.scrollY}`);
  }

  // 5) ODVETA: Radka (poražená) chce odvetu, začíná ona
  check("tlačítko odvety u poražené", (await text(B, "#endPrimary")).includes("Chci odvetu"));
  await B.click("#endPrimary");
  await myTurn(B);
  await A.waitForSelector("#endBox", { state: "hidden", timeout: T });
  check("odveta: nová deska u obou, začíná Radka, skóre 1 : 0", (await text(A, "#score")).includes("Mark 1 : 0 Radka") && (await text(A, "#status")).includes("Radka přemýšlí"));

  // 6) PARTIE 2: lev doběhne do cíle
  await mv(B, A, "m15");
  await mv(A, B, "ma6");
  await mv(B, A, "m58");
  await mv(A, B, "m63");
  await mv(B, A, "m8b", { end: true });
  await B.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await B.waitForTimeout(1800);
  await shot(B, "m-07-vyhra-cil");
  check("výhra lvem v cíli (Radka)", (await text(B, "#endL1")).includes("doběhl do cíle") && (await text(B, "#endL2")).includes("Vyhráváš"));
  check("Mark vidí prohru: soupeřův lev v cíli", (await text(A, "#endL1")).includes("Soupeřův lev doběhl do cíle"));
  check("razítko LEV V CÍLI", (await text(A, "#hanko")).replace(/\s+/g, " ").includes("LEV V CÍLI"));
  check("skóre série 1 : 1", (await text(A, "#tSer")).includes("Mark 1 : 1 Radka"));

  // 7) ODVETA od Marka + tah zpět + remíza opakováním
  await A.click("#endPrimary");
  await myTurn(A);
  await B.waitForSelector("#endBox", { state: "hidden", timeout: T });
  await A.locator('#board .cell[data-i="11"]').click();
  await A.locator('#board .cell[data-i="8"]').click();
  await myTurn(B);
  await A.waitForSelector("#undoBtn:not([hidden])", { timeout: T });
  await A.click("#undoBtn");
  await myTurn(A);
  await B.waitForFunction(() => !document.title.startsWith("Jsi na tahu"), null, { timeout: T });
  await B.waitForTimeout(400);
  check("tah zpět: žirafa je zpět na C1 i u Radky", (await label(B, 11)).includes("žirafa") && !(await label(B, 8)).includes("žirafa"));
  const loop = ["mb8", "m03", "m8b", "m30"];
  for (const [k, m] of [...loop, ...loop].entries()) {
    const last = k === 7;
    await (k % 2 ? mv(B, A, m, { end: last }) : mv(A, B, m, { end: last }));
  }
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  check("remíza opakováním pozice", (await text(A, "#endL1")).includes("Remíza") && (await text(B, "#endL1")).includes("Remíza"));
  check("série po remíze zůstává 1 : 1", (await text(B, "#tSer")).includes("Mark 1 : 1 Radka"));

  // 8) aplikace z plochy: tlačítko skryté, prázdné úložiště → vložení odkazu na hru
  {
    const sctx = await bA.newContext({ ...devices["iPhone 13"], isMobile: false, userAgent: devices["iPhone 13"].userAgent });
    const S = await sctx.newPage();
    await S.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    S.on("pageerror", e => errs.push("S: " + e.message));
    await S.goto(URL);
    await S.waitForSelector("#setup:not([hidden])");
    check("plocha (standalone): tlačítko celé obrazovky je skryté", await S.locator("#fsBtn").isHidden());
    check("plocha: prázdný seznam her nabídne pole „Vlož odkaz na hru“", await S.locator("#joinForm").isVisible());
    await shot(S, "m-08-plocha-vlozit");
    await S.fill("#joinLink", "tohle není odkaz");
    await S.click("#joinBtn");
    check("plocha: špatný text hru neotevře a ukáže hlášku", await S.locator("#toast").isVisible() && await S.locator("#setup").isVisible());
    await S.fill("#joinLink", link);
    await S.click("#joinBtn");
    await S.waitForSelector("#game:not([hidden])", { timeout: T });
    check("plocha: vložený celý odkaz otevře rozehranou hru (přihlížející s tlačítky „Jsem …“)", await S.locator("#claims").isVisible() && (await text(S, "#claimO")).includes("Jsem Radka"), await S.evaluate(() => location.hash));
    await sctx.close();
    const sctx2 = await bA.newContext({ ...devices["Pixel 7"] });
    const S2 = await sctx2.newPage();
    await S2.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
    await S2.goto(URL);
    await S2.waitForSelector("#joinForm:not([hidden])");
    await S2.fill("#joinLink", "#r." + link.split("#r.")[1]);
    await S2.click("#joinBtn");
    await S2.waitForSelector("#game:not([hidden])", { timeout: T });
    check("plocha: vložené jen „#r.<id>“ také otevře hru", (await S2.evaluate(() => location.hash)) === "#r." + link.split("#r.")[1]);
    await sctx2.close();
    const sctx3 = await bA.newContext({ ...devices["Pixel 7"] });
    const S3 = await sctx3.newPage();
    await S3.goto(URL);
    await S3.waitForSelector("#setup:not([hidden])");
    check("běžný prohlížeč: pole pro vložení odkazu se neukazuje a tlačítko ano", await S3.locator("#joinForm").isHidden() && await S3.locator("#fsBtn").isVisible());
    await sctx3.close();
  }

  // 9) přihlížející (třetí prohlížeč, omezený pohyb)
  const C = await (await bA.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" })).newPage();
  await C.goto(link);
  await C.waitForSelector("#game:not([hidden])", { timeout: T });
  check("třetí návštěvník jen přihlíží", (await text(C, "#endL2")).length > 0 && await C.locator("#endPrimary").isHidden());

  // 10) matice rozvržení (mock sítě, Chromium): rozměry z pokynů
  const matrix = [["iPhone 13 390×664", 390, 664, true], ["iPhone SE 375×667", 375, 667, true], ["mobil 390×844", 390, 844, true], ["desktop 1280×800", 1280, 800, false], ["desktop 1440×900", 1440, 900, false]];
  let ref = 0; const out = {};
  for (const [name, w, h, mobile] of matrix) {
    const ctx = await bA.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const { page, put } = await mockPage(ctx, () => localStorage.setItem("zs-r-matrix0001", "x"));
    put("matrix0001", doc(MOVES));
    page.on("pageerror", e => errs.push(name + ": " + e.message));
    await page.goto(URL + "#r.matrix0001");
    await page.waitForSelector("#game:not([hidden])"); await page.waitForTimeout(1700);
    const m = await measure(page);
    if (mobile && !ref) ref = m.stage.w;
    layoutChecks(`rozvržení ${name}`, m, { desktop: !mobile, minBoardW: ref });
    out[name] = m;
    await shot(page, `layout-svetly-${w}x${h}`);
    await ctx.close();
  }
  check("měření: #seatBot bottom vs. innerHeight (375×667, 390×664, 1280×800)", true,
    ["iPhone SE 375×667", "iPhone 13 390×664", "desktop 1280×800"].map(k => `${k}: ${out[k].bot.bottom}/${out[k].ih}`).join("; "));

  // 11) tmavý režim: obchůzka všech obrazovek na mobilu (WebKit iPhone 13) a desktopu (Chromium), snímky + kontrast
  async function tour(browser, opts, tag) {
    const ctx = await browser.newContext({ ...opts, colorScheme: "dark" });
    const mk = async (id, d, me) => { const o = await mockPage(ctx, me ? `localStorage.setItem("zs-r-${id}", "${me}")` : null); if (d) o.put(id, d); o.page.on("pageerror", e => errs.push(tag + ": " + e.message)); return o; };
    const dark = async (p, n) => {
      await p.waitForTimeout(350);
      await shot(p, `tmavy-${tag}-${n}`);
      const f = await p.evaluate(`(${audit.toString()})()`);
      check(`tmavý režim ${tag}: ${n}, kontrast textů ≥ 4,5:1 (velké 3:1)`, f.length === 0, f.slice(0, 2).join(" | "));
      check(`tmavý režim ${tag}: ${n}, tmavé pozadí stránky`, await p.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return c[0] + c[1] + c[2] < 200; }));
    };
    let o = await mk("tsetup0001"), p = o.page;
    await p.goto(URL); await p.waitForSelector("#setup:not([hidden])"); await dark(p, "01-uvod");
    await p.fill("#nameX", "Mark"); await p.fill("#nameO", "Radka"); await p.selectOption("#stakeSel", "1");
    await p.click("#helpBtn"); await p.waitForSelector("#helpSheet[open]"); await dark(p, "02-napoveda"); await p.keyboard.press("Escape");
    await p.click("#setupSubmit"); await p.waitForSelector("#share:not([hidden])"); await dark(p, "03-share");
    await p.click("#backBtn"); await p.click("#menuBtn"); await p.waitForSelector("#menuSheet[open]"); await dark(p, "04-nabidka"); await p.keyboard.press("Escape");
    o = await mk("tintro0001", doc([], ""));
    await o.page.goto(URL + "#r.tintro0001"); await o.page.waitForSelector("#intro:not([hidden])"); await dark(o.page, "05-vyzva");
    o = await mk("tplay00001", doc(MOVES), "x");
    await o.page.goto(URL + "#r.tplay00001"); await o.page.waitForSelector("#game:not([hidden])"); await o.page.waitForTimeout(1400);
    await o.page.locator('#board .cell[data-i="6"]').click(); await dark(o.page, "06-partie-vyber");
    o = await mk("tplay00002", doc(["m74", "m24"]), "x");
    await o.page.goto(URL + "#r.tplay00002"); await o.page.waitForSelector("#game:not([hidden])"); await o.page.waitForTimeout(1400);
    await o.page.locator("#seatBot .hp").first().click(); await dark(o.page, "07-partie-zasoba-vyber");
    o = await mk("tplay00003", doc(END), "x");
    await o.page.goto(URL + "#r.tplay00003"); await o.page.waitForSelector("#endBox:not([hidden])"); await o.page.waitForTimeout(1800); await dark(o.page, "08-konec-razitko");
    o = await mk("tplay00004", doc(MOVES));
    await o.page.goto(URL + "#r.tplay00004"); await o.page.waitForSelector("#claims:not([hidden])"); await dark(o.page, "09-prihlizejici");
    await o.page.evaluate(() => document.getElementById("installSheet").showModal()); await dark(o.page, "10-pridat-na-plochu");
    await ctx.close();
  }
  await tour(bA, { viewport: { width: 1280, height: 800 } }, "desktop");
  await tour(bB, { ...devices["iPhone 13"] }, "iphone");

  check("žádné chyby JavaScriptu", errs.length === 0, errs.join(" | "));
  console.log(`\n${pass} prošlo, ${fail} selhalo · ${link}`);
  fs.writeFileSync(path.join(SHOTS, "vysledek-desktop-iphone.txt"), log.join("\n") + `\n${pass} prošlo, ${fail} selhalo · ${link}\n`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
