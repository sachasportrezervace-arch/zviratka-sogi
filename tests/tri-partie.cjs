// Playtest tří partií za sebou ve dvou prohlížečích (Chromium desktop 1280×800 = Mark, WebKit iPhone 13 = Radka):
// kola se liší (varianta ze seedu), poražený vybírá variantu, titul a kosmetika naběhnou, žádné chyby JavaScriptu.
// Síť je falešná, ale sdílená mezi oběma prohlížeči (jeden store v tomhle procesu), takže běh je rychlý a nezávislý na mantledb.sh.
// node tests/tri-partie.cjs [URL]   (výchozí http://127.0.0.1:8791/)   screenshoty: tests/shots/tri-partie/ (proměnná SHOTS)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const H = require("./pomocne.cjs");
const S = require("../engine.js");
const audit = require("./kontrast.cjs");
const URL = process.argv[2] || "http://127.0.0.1:8791/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots", "tri-partie");
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

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) {
    p.on("pageerror", e => errs.push(n + ": " + e.message));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR|fonts\./.test(m.text())) errs.push(n + " console: " + m.text()); });
  }
  // sdílená falešná síť
  const store = {};
  for (const p of [A, B]) await p.route("https://mantledb.sh/**", route => {
    const r = route.request(), u = r.url();
    if (r.method() === "GET") return route.fulfill(store[u] ? { status: 200, contentType: "application/json", body: store[u] } : { status: 404, body: "" });
    if (r.method() === "POST") { store[u] = r.postData(); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    route.continue();
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
  // odehraje řadu tahů; první táhne `first` (stránka), druhý `second`
  async function playLine(line, first, second) {
    for (const [k, m] of line.entries()) {
      const end = k === line.length - 1;
      await (k % 2 === 0 ? mv(first, second, m, { end }) : mv(second, first, m, { end }));
    }
  }
  // rozvržení: celá deska i obě zásoby bez posouvání, štítek kola vidět, žádné vodorovné posouvání
  const fits = p => p.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const small = [...document.querySelectorAll("#board .cell, .hp, .iconbtn, #pickSeg button")].filter(e => e.offsetWidth).filter(e => { const b = e.getBoundingClientRect(); return b.width < 43.5 || b.height < 43.5; }).length;
    return { ok: scrollY === 0 && r("#seatTop").top >= 0 && r("#seatBot").bottom <= innerHeight && r("#status").bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth, small, bot: Math.round(r("#seatBot").bottom), st: Math.round(r("#status").bottom), ih: innerHeight };
  });
  const expectedBoard = async (p, vr, starter, mine) => {
    const exp = S.initial(starter, vr), me = mine;
    const sq = i => exp.b[i] ? `${exp.b[i].p === me ? "tvoje" : "soupeřova"} ${S.NAMES[exp.b[i].t].n}` : "prázdné";
    const got = await p.locator("#board .cell").evaluateAll(els => els.map(e => [+e.dataset.i, e.getAttribute("aria-label")]));
    const handN = await p.locator("#seatBot .tray .hp").count();
    return got.length === 12 && got.every(([i, l]) => l.includes(sq(i))) && handN === new Set(exp.h[me].map(c => c.t)).size;
  };
  const round = { vr: [], boards: [] };
  async function start(n, vr, starter) {
    round.vr.push(vr);
    check(`kolo ${n}: štítek „Kolo ${n} · ${S.VARIANTS[vr].n}“ u obou`, (await text(A, "#kolo")) === `Kolo ${n} · ${S.VARIANTS[vr].n}` && (await text(B, "#kolo")) === `Kolo ${n} · ${S.VARIANTS[vr].n}`);
    check(`kolo ${n}: deska a zásoby odpovídají variantě ${S.VARIANTS[vr].n} (Mark i Radka)`, (await expectedBoard(A, vr, starter, "x")) && (await expectedBoard(B, vr, starter, "o")));
    check(`kolo ${n}: v pravidlech je jedna věta o variantě`, (await A.locator(".aside-play .vr-rule").innerText()).includes(S.VARIANTS[vr].d) && await B.locator("#rulesSheet .vr-rule").evaluate(e => e.textContent).then(t => t.includes(S.VARIANTS[vr].d)));
    const fa = await fits(A), fb = await fits(B);
    check(`kolo ${n}: začátek se vejde bez posouvání, desktop i iPhone, cíle ≥ 44 px`, fa.ok && fb.ok && !fa.small && !fb.small, `desktop ${fa.bot}/${fa.ih}, iPhone seatBot ${fb.bot}, status ${fb.st}/${fb.ih}`);
    await shot(A, `kolo${n}-start-desktop-${vr}`); await shot(B, `kolo${n}-start-iphone-${vr}`);
  }

  // ---------- založení, kolo 1 ----------
  await A.goto(URL);
  await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka");
  await A.selectOption("#stakeSel", "1");
  await A.click('#starterSeg button[data-v="x"]');
  await A.click("#setupSubmit");
  await A.waitForSelector("#share:not([hidden])", { timeout: T });
  const link = await A.evaluate(() => location.href), room = H.roomOf(link);
  await A.click("#backBtn");
  await B.goto(link);
  await B.waitForSelector("#intro:not([hidden])", { timeout: T });
  await B.click("#acceptBtn");
  await B.waitForSelector("#game:not([hidden])", { timeout: T });
  await myTurn(A);
  const doc1 = JSON.parse(store[`https://mantledb.sh/v2/zviratka-${room}/hra`]).g;
  check("založená hra má vr = k a n = 1 (první kolo je vždy klasika)", doc1.vr === "k" && doc1.n === 1, JSON.stringify({ vr: doc1.vr, n: doc1.n }));
  await start(1, "k", "x");

  // ---------- kolo 1: Mark vyhrává, titul Učeň ----------
  await playLine(H.winLine("k", "x", "x"), A, B);
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await A.waitForTimeout(500); await B.waitForTimeout(500);
  check("kolo 1: vítěz Mark má titul Učeň, poražená Radka žádný", (await text(A, "#rkX")).includes("Učeň") && await A.locator("#rkO").isHidden() && await B.locator("#rkO").isHidden() && (await text(B, "#rkX")).includes("Učeň"));
  check("kolo 1: nově získaný titul se krátce zvýrazní (třída fresh)", await A.locator("#rkX.fresh").count() === 1 && await B.locator("#rkX.fresh").count() === 1);
  await shot(A, "kolo1-konec-desktop-titul"); await shot(B, "kolo1-konec-iphone-titul");
  const bEnd = await B.evaluate(() => { const b = document.getElementById("endBox"); b.scrollIntoView({ block: "end" }); return null; });
  await B.waitForTimeout(2300); await A.waitForTimeout(1200);
  await shot(B, "kolo1-konec-iphone-vyber");
  check("kolo 1: zvýraznění po chvíli zhasne a nic dalšího se neukazuje", await A.locator("#rkX.fresh").count() === 0 && await B.locator("#rkX.fresh").count() === 0);
  check("kolo 1: bez kosmetiky (kotouče bez lakovaného okraje, razítko kulaté)", await A.locator(".disc.lak").count() === 0 && await B.locator(".disc.lak").count() === 0 && !(await A.locator("#hanko").evaluate(e => e.classList.contains("sq"))));
  const offer2 = S.offer(room, 2, "k");
  check("kolo 1: poražená vidí 2 varianty ze seedu a první je předvybraná; vítěz výběr nemá", JSON.stringify(await B.locator("#pickSeg button").evaluateAll(els => els.map(e => e.dataset.vr))) === JSON.stringify(offer2) && await B.locator("#pickSeg button[aria-pressed=true]").getAttribute("data-vr") === offer2[0] && await A.locator("#pickSeg").isHidden(), offer2.join());
  await A.reload();
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await A.waitForTimeout(400);
  check("kolo 1: po znovunačtení se titul už nezvýrazňuje podruhé", await A.locator("#rkX.fresh").count() === 0 && (await text(A, "#rkX")).includes("Učeň"));

  // ---------- kolo 2: Radka (poražená) vybírá druhou variantu, začíná ona ----------
  const rm2 = await H.rematchPick(B);
  await myTurn(B);
  await A.waitForSelector("#endBox", { state: "hidden", timeout: T });
  const vr2 = rm2.pick;
  check("kolo 2: jiná varianta než kolo 1 a je to ta, kterou poražená vybrala", vr2 !== "k" && vr2 === offer2[1] && (await H.vrOf(A)) === vr2 && (await H.vrOf(B)) === vr2, `k → ${vr2}`);
  await start(2, vr2, "o");
  await playLine(H.winLine(vr2, "o", "x"), B, A);
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await A.waitForTimeout(600); await B.waitForTimeout(600);
  check("kolo 2: druhá výhra je pořád Učeň, nic se nezvýrazňuje, kosmetika ještě není", (await text(A, "#rkX")).includes("Učeň") && await A.locator("#rkX.fresh").count() === 0 && await A.locator(".disc.lak").count() === 0 && (await text(A, "#tSer")).includes("Mark 2 : 0 Radka"));
  await shot(A, "kolo2-konec-desktop"); await shot(B, "kolo2-konec-iphone");

  // ---------- kolo 3: Radka vybírá znovu (nechá první), Mark vyhrává potřetí = Strážce zásoby, lak, hranaté razítko ----------
  const offer3 = S.offer(room, 3, vr2);
  await B.evaluate(() => document.getElementById("endBox").scrollIntoView({ block: "end" }));
  await B.waitForTimeout(300);
  check("kolo 3: nabídka bez varianty z kola 2", JSON.stringify(await B.locator("#pickSeg button").evaluateAll(els => els.map(e => e.dataset.vr))) === JSON.stringify(offer3) && !offer3.includes(vr2), offer3.join());
  await B.click("#endPrimary");
  await myTurn(B);
  await A.waitForSelector("#endBox", { state: "hidden", timeout: T });
  const vr3 = offer3[0];
  check("kolo 3: varianta je první nabídnutá (poražená nic nepřepnula) a liší se od kola 2", (await H.vrOf(A)) === vr3 && (await H.vrOf(B)) === vr3 && vr3 !== vr2, `${vr2} → ${vr3}`);
  await start(3, vr3, "o");
  await playLine(H.winLine(vr3, "o", "x"), B, A);
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await A.waitForTimeout(700); await B.waitForTimeout(700);
  check("kolo 3: třetí výhra = Strážce zásoby, zvýrazněný titul", (await text(A, "#rkX")).includes("Strážce zásoby") && await A.locator("#rkX.fresh").count() === 1 && await B.locator("#rkX.fresh").count() === 1);
  check("kolo 3: kosmetika: Markův kotouč (obě zařízení) a čip má lakovaný okraj, Radčin ne", await A.locator("#seatBot .disc.lak").count() === 1 && await B.locator("#seatTop .disc.lak").count() === 1 && await A.locator("#seatTop .disc.lak").count() === 0 && await B.locator("#seatBot .disc.lak").count() === 0 && await A.locator("#rkX .disc.lak").count() === 1);
  check("kolo 3: razítko je hranaté (sq) u obou", await A.locator("#hanko.sq").count() === 1 && await B.locator("#hanko.sq").count() === 1);
  const lakStyle = await A.locator("#seatBot .disc.lak").evaluate(e => { const s = getComputedStyle(e, "::after"); return { content: s.content, border: s.borderTopWidth, radius: s.borderTopLeftRadius }; });
  check("kolo 3: lakovaný okraj je tenký vnitřní kroužek (pseudoprvek, ≤ 2 px)", lakStyle.content !== "none" && parseFloat(lakStyle.border) <= 2, JSON.stringify(lakStyle));
  const aud = async (p, n) => { const f = await p.evaluate(`(${audit.toString()})()`); check(`kolo 3 konec: ${n}, kontrast textů ≥ 4,5:1 (velké 3:1)`, f.length === 0, f.slice(0, 2).join(" | ")); };
  await aud(A, "desktop, světlý"); await aud(B, "iPhone, světlý");
  await shot(A, "kolo3-konec-desktop-titul-lak"); await B.evaluate(() => document.getElementById("endBox").scrollIntoView({ block: "end" })); await shot(B, "kolo3-konec-iphone-titul-lak");
  await B.evaluate(() => scrollTo(0, 0)); await B.waitForTimeout(150); await shot(B, "kolo3-konec-iphone-razitko-hranate");
  await A.waitForTimeout(2200);
  check("kolo 3: zvýraznění zhasne a kosmetika zůstane", await A.locator("#rkX.fresh").count() === 0 && await A.locator("#seatBot .disc.lak").count() === 1);
  // tmavý režim téhož konce
  for (const p of [A, B]) await p.emulateMedia({ colorScheme: "dark" });
  await A.waitForTimeout(300);
  await aud(A, "desktop, tmavý"); await aud(B, "iPhone, tmavý");
  await shot(A, "kolo3-konec-desktop-tmavy"); await B.evaluate(() => document.getElementById("endBox").scrollIntoView({ block: "end" })); await shot(B, "kolo3-konec-iphone-tmavy");
  for (const p of [A, B]) await p.emulateMedia({ colorScheme: "light" });

  // ---------- kolo 4: odvetu spouští vítěz, takže platí první nabídnutá varianta ----------
  const offer4 = S.offer(room, 4, vr3);
  await A.click("#endPrimary");
  await myTurn(B);
  check("kolo 4: odvetu spustil vítěz, platí první nabídnutá varianta", (await H.vrOf(A)) === offer4[0] && (await H.vrOf(B)) === offer4[0] && offer4[0] !== vr3, `${vr3} → ${offer4[0]}`);
  await start(4, offer4[0], "o");
  check("kola 1–4: každé kolo má jinou variantu než předchozí", round.vr.every((v, i) => i === 0 || v !== round.vr[i - 1]), round.vr.join(" → "));
  check("kola 1–3: aspoň dvě různé rozestavení desky", new Set(round.vr.slice(0, 3)).size >= 2);
  check("žádné chyby JavaScriptu", errs.length === 0, errs.join(" | "));
  console.log(`\n${pass} prošlo, ${fail} selhalo · varianty ${round.vr.join(" → ")}`);
  fs.writeFileSync(path.join(SHOTS, "vysledek.txt"), log.join("\n") + `\n${pass} prošlo, ${fail} selhalo\n`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
