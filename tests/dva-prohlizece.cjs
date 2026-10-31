// Celá partie ve 2 nezávislých prohlížečích (Chromium jako Android, WebKit jako iPhone) + přihlížející.
// node tests/dva-prohlizece.cjs [URL]   (výchozí http://127.0.0.1:8791/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const H = require("./pomocne.cjs");
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
  check("první partie místnosti je vždy klasika: štítek „Kolo 1 · Klasika“ u obou", (await H.koloText(A)) === "Kolo 1 · Klasika" && (await H.koloText(B)) === "Kolo 1 · Klasika" && (await H.vrOf(A)) === "k");

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
  // varianta kola: první partie je klasika, poražená (Radka) vybírá z dvou nabídnutých, vítěz (Mark) jen vidí první
  const room = H.roomOf(link), S = require("../engine.js");
  const offer2 = S.offer(room, 2, "k");
  check("vítěz u odvety nemá výběr, jen vidí první nabídnutou variantu a že volí poražený", await A.locator("#pickSeg").isHidden() && (await text(A, "#pickNote")).includes(S.VARIANTS[offer2[0]].n) && (await text(A, "#pickNote")).includes("volí poražený"));
  const rm = await H.rematchPick(B);
  check("poražená vidí dvě nabídnuté varianty ze seedu (id místnosti + kolo), bez klasiky, první je předvybraná", JSON.stringify(rm.offer) === JSON.stringify(offer2) && !rm.offer.includes("k") && rm.before === offer2[0], rm.offer.join());
  check("poražená přepnula na druhou variantu a popis se změnil", rm.pressed === "true" && rm.note.includes(S.VARIANTS[rm.pick].n) && rm.note.includes(S.VARIANTS[rm.pick].d), rm.note);
  await myTurn(B);
  await A.waitForSelector("#endBox", { state: "hidden", timeout: T });
  const vr2 = rm.pick;
  check("odveta: nová deska u obou, začíná Radka, skóre 1 : 0", (await text(A, "#score")).includes("Mark 1 : 0 Radka") && (await text(A, "#status")).includes("Radka přemýšlí"));
  check("odveta: obě zařízení ukazují Kolo 2 a vybranou variantu", (await H.vrOf(A)) === vr2 && (await H.vrOf(B)) === vr2 && (await H.koloText(A)) === `Kolo 2 · ${S.VARIANTS[vr2].n}` && (await H.koloText(B)) === `Kolo 2 · ${S.VARIANTS[vr2].n}`, await H.koloText(A));
  {
    // deska odpovídá variantě z enginu (typ i vlastník každého pole z pohledu Marka)
    const exp = S.initial("o", vr2), sq = i => exp.b[i] ? `${exp.b[i].p === "x" ? "tvoje" : "soupeřova"} ${S.NAMES[exp.b[i].t].n}` : "prázdné";
    const got = await A.locator("#board .cell").evaluateAll(els => els.map(e => [+e.dataset.i, e.getAttribute("aria-label")]));
    check(`odveta: rozestavení desky odpovídá variantě ${S.VARIANTS[vr2].n}`, got.length === 12 && got.every(([i, l]) => l.includes(sq(i))), got.filter(([i, l]) => !l.includes(sq(i))).map(x => x.join("=")).join("; "));
    const hand = await A.locator("#seatBot .tray .hp").count();
    check("odveta: zásoba na začátku odpovídá variantě", hand === new Set(exp.h.x.map(c => c.t)).size, `${hand} kamenů`);
  }
  await A.screenshot({ path: path.join(SHOTS, "07a-odveta-varianta.png") });

  // 5) PARTIE 2: lev doběhne do cíle (řada tahů se hledá enginem pro vybranou variantu; začíná Radka, vyhrává Radka)
  const line2 = H.winLine(vr2, "o", "o", ["cil"]);
  for (const [k, m] of line2.entries()) await (k % 2 === 0 ? mv(B, A, m, { end: k === line2.length - 1 }) : mv(A, B, m));
  await B.waitForSelector("#endBox:not([hidden])", { timeout: T });
  await B.waitForTimeout(1800);
  await B.screenshot({ path: path.join(SHOTS, "07-vyhra-cil.png") });
  check("výhra lvem v cíli (Radka)", (await text(B, "#endL1")).includes("doběhl do cíle") && (await text(B, "#endL2")).includes("Vyhráváš"));
  check("Mark vidí prohru: soupeřův lev v cíli", (await text(A, "#endL1")).includes("Soupeřův lev doběhl do cíle"));
  check("razítko LEV V CÍLI", (await text(A, "#hanko")).replace(/\s+/g, " ").includes("LEV V CÍLI"));
  check("série 1 : 1", (await text(A, "#tSer")).includes("Mark 1 : 1 Radka"));

  // 6) ODVETA od Marka (poražený Mark vybírá) + tah zpět + remíza opakováním
  const offer3 = S.offer(room, 3, vr2);
  check("u Radky (vítězka) je jen první nabídka, bez výběru", await B.locator("#pickSeg").isHidden() && (await text(B, "#pickNote")).includes(S.VARIANTS[offer3[0]].n));
  const rm3 = await H.rematchPick(A);
  check("Mark (poražený) vidí 2 nabídnuté varianty ze seedu, nikdy tu, která se právě hrála", JSON.stringify(rm3.offer) === JSON.stringify(offer3) && !rm3.offer.includes(vr2), rm3.offer.join());
  await myTurn(A);
  await B.waitForSelector("#endBox", { state: "hidden", timeout: T });
  const vr3 = rm3.pick;
  check("kolo 3: obě zařízení ukazují vybranou variantu, kola se liší", (await H.vrOf(A)) === vr3 && (await H.vrOf(B)) === vr3 && vr3 !== vr2 && (await H.koloText(B)) === `Kolo 3 · ${S.VARIANTS[vr3].n}`, `${vr2} → ${vr3}`);
  const q = H.quietMove(vr3, "x"), qf = parseInt(q[1], 12), qt = parseInt(q[2], 12);
  await A.locator(`#board .cell[data-i="${qf}"]`).click();
  await A.locator(`#board .cell[data-i="${qt}"]`).click();
  await myTurn(B);
  await A.waitForSelector("#undoBtn:not([hidden])", { timeout: T });
  await A.click("#undoBtn");
  await myTurn(A);
  await B.waitForFunction(() => !document.title.startsWith("Jsi na tahu"), null, { timeout: T });
  await B.waitForTimeout(400);
  check("tah zpět: figurka je zpět na původním poli i u Radky", !(await label(B, qf)).includes("prázdné") && (await label(B, qt)).includes("prázdné"), q);
  const loop = H.loopLine(vr3, "x");
  for (const [k, m] of [...loop, ...loop].entries()) {
    const last = k === 7;
    await (k % 2 ? mv(B, A, m, { end: last }) : mv(A, B, m, { end: last }));
  }
  await A.waitForSelector("#endBox:not([hidden])", { timeout: T });
  check("remíza opakováním pozice", (await text(A, "#endL1")).includes("Remíza") && (await text(B, "#endL1")).includes("Remíza"));
  check("série po remíze zůstává 1 : 1", (await text(B, "#tSer")).includes("Mark 1 : 1 Radka"));
  const offer4 = S.offer(room, 4, vr3);
  check("po remíze nikdo nevybírá, ukáže se první nabídnutá varianta", await A.locator("#pickSeg").isHidden() && await B.locator("#pickSeg").isHidden() && (await text(A, "#pickNote")).includes(S.VARIANTS[offer4[0]].n) && !(await text(A, "#pickNote")).includes("volí poražený"));
  check("kolo 3 skončilo remízou a číslo kola se přesto zvýšilo (Kolo 3 · …)", (await text(A, "#endMeta")).startsWith(`Kolo 3 · ${S.VARIANTS[vr3].n}`), await text(A, "#endMeta"));

  // 7) přihlížející (třetí prohlížeč, omezený pohyb)
  const C = await (await bA.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" })).newPage();
  await C.goto(link);
  await C.waitForSelector("#game:not([hidden])", { timeout: T });
  check("třetí návštěvník jen přihlíží", (await text(C, "#endL2")).length > 0 && await C.locator("#endPrimary").isHidden());

  // 8) odveta po remíze spustí první nabídnutou variantu (nikdo nevybíral)
  await A.click("#endPrimary");
  await myTurn(B);
  check("odveta po remíze: platí první nabídnutá varianta u obou, Kolo 4", (await H.vrOf(A)) === offer4[0] && (await H.vrOf(B)) === offer4[0] && (await H.koloText(A)) === `Kolo 4 · ${S.VARIANTS[offer4[0]].n}`, `${offer4.join()} → ${await H.vrOf(A)}`);
  await A.screenshot({ path: path.join(SHOTS, "08-kolo4-po-remize.png") });

  check("žádné chyby JavaScriptu", errs.length === 0, errs.join(" | "));
  console.log(`\n${pass} prošlo, ${fail} selhalo · ${link}`);
  require("fs").writeFileSync(path.join(SHOTS, "vysledek.txt"), log.join("\n") + `\n${pass} prošlo, ${fail} selhalo · ${link}\n`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
