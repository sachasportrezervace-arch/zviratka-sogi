// Celá partie ve 2 nezávislých prohlížečích (Chromium jako Android, WebKit jako iPhone) + přihlížející.
// node tests/dva-prohlizece.cjs [URL]   (výchozí http://127.0.0.1:8791/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const URL = process.argv[2] || "http://127.0.0.1:8791/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
require("fs").mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const log = [];
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`;
  log.push(line); console.log(line);
}
const T = 15000;

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const A = await (await bA.newContext({ ...devices["Pixel 7"] })).newPage();
  const B = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) p.on("pageerror", e => errs.push(n + ": " + e.message));

  const title = p => p.evaluate(() => document.title);
  const myTurn = (p, timeout = T) => p.waitForFunction(() => document.title.startsWith("Jsi na tahu"), null, { timeout });
  const text = (p, sel) => p.locator(sel).first().innerText();
  const label = (p, i) => p.locator(`#board .cell[data-i="${i}"]`).getAttribute("aria-label");
  async function mv(p, other, m, { end = false } = {}) {
    await myTurn(p);
    if (m[0] === "m") {
      const f = parseInt(m[1], 12), t = parseInt(m[2], 12);
      await p.locator(`#board .cell[data-i="${f}"]`).click();
      await p.locator(`#board .cell[data-i="${t}"]`).click();
    } else {
      await p.locator(`#seatBot .hp[data-t="${m[1]}"]`).first().click();
      await p.locator(`#board .cell[data-i="${parseInt(m[2], 12)}"]`).click();
    }
    if (end) await other.waitForSelector("#endBox:not([hidden])", { timeout: T });
    else await myTurn(other);
  }

  // 1) založení výzvy
  await A.goto(URL);
  await A.screenshot({ path: path.join(SHOTS, "01-zalozeni.png") });
  await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka");
  await A.selectOption("#stakeSel", "1");
  await A.click('#starterSeg button[data-v="x"]');
  await A.click("#setupSubmit");
  await A.waitForSelector("#share:not([hidden])", { timeout: T });
  const link = await A.evaluate(() => location.href);
  const msg = await A.inputValue("#msg");
  check("výzva: odkaz #r.<id> a zpráva se jménem a sázkou", /#r\.[0-9a-z]{12}$/.test(link) && msg.includes("Mark tě vyzývá") && msg.includes("platí kafe") && msg.includes(link), link);
  await A.click("#backBtn");

  // 2) Radka otevře odkaz a přijme
  await B.goto(link);
  await B.waitForSelector("#intro:not([hidden])", { timeout: T });
  await B.screenshot({ path: path.join(SHOTS, "02-vyzva.png") });
  check("výzva u soupeře: jména + sázka", (await text(B, "#introTitle")).includes("Mark tě vyzývá") && (await text(B, "#introStake")).includes("platí kafe"));
  await B.click("#acceptBtn");
  await B.waitForSelector("#game:not([hidden])", { timeout: T });
  check("Radka po přijetí čeká na tah Marka", (await text(B, "#status")).includes("Mark přemýšlí"));
  await myTurn(A);
  check("Mark vidí, že výzva je přijatá a začíná", (await text(A, "#status")).startsWith("Začínáš"));

  // nápověda tahů: výběr žirafy ukáže cíle
  await A.locator('#board .cell[data-i="11"]').click();
  const tg = await A.locator("#board .cell.target").evaluateAll(els => els.map(e => +e.dataset.i).sort((a, b) => a - b));
  check("nápověda: žirafa na C1 smí jen na C2", JSON.stringify(tg) === "[8]", JSON.stringify(tg));
  await A.screenshot({ path: path.join(SHOTS, "03-napoveda.png") });
  await A.locator('#board .cell[data-i="11"]').click();

  // 3) PARTIE 1: sebrání, položení, proměna, chycení lva
  await myTurn(A);
  await A.locator('#board .cell[data-i="7"]').click();
  check("nápověda: kuřátko ukazuje sebrání (červený rámeček)", await A.locator('#board .cell[data-i="4"].target.cap').count() === 1);
  await A.locator('#board .cell[data-i="4"]').click();
  const ghostA = await A.waitForSelector("#fx .ghost", { timeout: 2000 }).then(() => true, () => false);
  await A.waitForTimeout(500);
  await A.screenshot({ path: path.join(SHOTS, "04-preběhnuti.png") });
  check("sebrání: u Marka animace přeběhnutí (figurka letí do zásoby)", ghostA);
  const ghostB = await B.waitForSelector("#fx .ghost", { timeout: T }).then(() => true, () => false);
  check("sebrání: u Radky stejná animace po synchronizaci", ghostB);
  await myTurn(B);
  await A.waitForTimeout(1400);
  check("sebrané kuřátko je v Markově zásobě (modré)", await A.locator('#seatBot .tray .hp[data-t="C"] .own-x').count() === 1);
  check("Radka vidí kuřátko v Markově zásobě", await B.locator('#seatTop .tray .hp[data-t="C"] .own-x').count() === 1);

  await mv(B, A, "m24");
  await A.waitForTimeout(1400);
  check("Radčin slon sebral kuřátko, je v její zásobě", await B.locator('#seatBot .tray .hp[data-t="C"] .own-o').count() === 1);

  // položení ze zásoby
  await myTurn(A);
  await A.locator('#seatBot .hp[data-t="C"]').first().click();
  const empties = await A.evaluate(() => [...document.querySelectorAll("#board .cell")].filter(c => !c.querySelector(".pc")).length);
  const dropT = await A.locator("#board .cell.target").count();
  check("položení: zvýrazněna všechna volná pole", dropT === empties && dropT > 0, `${dropT}/${empties}`);
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
  await A.screenshot({ path: path.join(SHOTS, "05-vyhra-lev.png") });
  await B.screenshot({ path: path.join(SHOTS, "06-prohra-lev.png") });
  check("výhra chycením lva (Mark)", (await text(A, "#endL1")).includes("Lev je chycený") && (await text(A, "#endL2")).includes("Vyhráváš"));
  check("prohra u Radky", (await text(B, "#endL1")).includes("Tvůj lev je chycený") && (await text(B, "#endL2")).includes("Vyhrává Mark"));
  check("razítko LEV CHYCEN", (await text(A, "#hanko")).replace(/\s+/g, " ").includes("LEV CHYCEN"));
  check("sázka: Radka platí kafe", (await text(A, "#tRes")).includes("Radka platí kafe") && (await text(B, "#tRes")).includes("Kafe platíš ty"));
  check("série 1 : 0", (await text(A, "#tSer")).includes("Mark 1 : 0 Radka"));
  check("chycený lev je v Markově zásobě", await A.locator('#seatBot .tray [data-id="1"]').count() === 1);

  // 4) ODVETA: Radka (poražená) chce odvetu, začíná ona
  check("tlačítko odvety u poražené", (await text(B, "#endPrimary")).includes("Chci odvetu"));
  await B.click("#endPrimary");
  await myTurn(B);
  await A.waitForSelector("#endBox", { state: "hidden", timeout: T });
  check("odveta: nová deska u obou, začíná Radka, skóre 1 : 0", (await text(A, "#score")).includes("Mark 1 : 0 Radka") && (await text(A, "#status")).includes("Radka přemýšlí"));

  // 5) PARTIE 2: lev doběhne do cíle
  await mv(B, A, "m15");
  await mv(A, B, "ma6");
  await mv(B, A, "m58");
  await mv(A, B, "m63");
  await mv(B, A, "m8b", { end: true });
  await B.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await B.waitForTimeout(1800);
  await B.screenshot({ path: path.join(SHOTS, "07-vyhra-cil.png") });
  check("výhra lvem v cíli (Radka)", (await text(B, "#endL1")).includes("doběhl do cíle") && (await text(B, "#endL2")).includes("Vyhráváš"));
  check("Mark vidí prohru: soupeřův lev v cíli", (await text(A, "#endL1")).includes("Soupeřův lev doběhl do cíle"));
  check("razítko LEV V CÍLI", (await text(A, "#hanko")).replace(/\s+/g, " ").includes("LEV V CÍLI"));
  check("série 1 : 1", (await text(A, "#tSer")).includes("Mark 1 : 1 Radka"));

  // 6) ODVETA od Marka + tah zpět + remíza opakováním
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

  // 7) přihlížející (třetí prohlížeč, omezený pohyb)
  const C = await (await bA.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" })).newPage();
  await C.goto(link);
  await C.waitForSelector("#game:not([hidden])", { timeout: T });
  check("třetí návštěvník jen přihlíží", (await text(C, "#endL2")).length > 0 && await C.locator("#endPrimary").isHidden());

  check("žádné chyby JavaScriptu", errs.length === 0, errs.join(" | "));
  console.log(`\n${pass} prošlo, ${fail} selhalo · ${link}`);
  require("fs").writeFileSync(path.join(SHOTS, "vysledek.txt"), log.join("\n") + `\n${pass} prošlo, ${fail} selhalo · ${link}\n`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
