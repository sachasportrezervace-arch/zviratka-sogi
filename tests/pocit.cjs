// Pocit ze hry: odezva dotyku uprostřed animace, stopa soupeřova tahu, počitadlo v zásobě, razítko mimo poslední tah,
// zkrácené animace, žádné nekonečné animace a reduced motion. Běží nad falešnou sítí (route na mantledb.sh).
// node tests/pocit.cjs [URL]   (výchozí http://127.0.0.1:8805/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const S = require("../engine.js");
const URL = process.argv[2] || "http://127.0.0.1:8805/";

let pass = 0, fail = 0;
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
}
const doc = (m, v = 5) => JSON.stringify({ app: "zviratka", v, sx: "dx", so: "do", g: { x: "Mark", o: "Radka", s: "x", m, t: null, k: "1", kc: "", w: [0, 0], r: "" } });
const key = id => `https://mantledb.sh/v2/zviratka-${id}/hra`;

// partie, kde má Mark v zásobě dvě stejná zvířátka (deterministické hledání enginem)
function twoSame() {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let n = 0; n < 4000; n++) {
    const m = [];
    for (let k = 0; k < 40; k++) {
      const g = { s: "x", m, r: "" }, r = S.play(g);
      if (r.result) break;
      const mv = S.moves(r.s);
      if (!mv.length) break;
      m.push(S.enc(mv[Math.floor(rnd() * mv.length)]));
      const q = S.play({ s: "x", m, r: "" });
      if (q.result || !q.ok) break;
      const h = q.s.h.x.map(c => c.t);
      if (["G", "E", "C"].some(t => h.filter(x => x === t).length === 2)) return m;
    }
  }
  return null;
}

async function mk(browser, ctxOpt, id, d, me = "x") {
  const ctx = await browser.newContext(ctxOpt), store = { [key(id)]: d }, page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.route("https://mantledb.sh/**", route => {
    const r = route.request(), u = r.url();
    if (r.method() === "GET") return route.fulfill(store[u] ? { status: 200, contentType: "application/json", body: store[u] } : { status: 404, body: "" });
    if (r.method() === "POST") { store[u] = r.postData(); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    route.continue();
  });
  await page.addInitScript(([i, m]) => {
    localStorage.setItem("zs-r-" + i, m);
    window.__fxlog = [];
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(ms => ms.forEach(r => {
      r.addedNodes.forEach(n => window.__fxlog.push({ k: "+", c: String(n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className), t: performance.now() }));
      r.removedNodes.forEach(n => window.__fxlog.push({ k: "-", c: String(n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className), t: performance.now() }));
    })).observe(document.getElementById("fx"), { childList: true }));
  }, [id, me]);
  return { ctx, page, store, errs, put: d2 => { store[key(id)] = d2; } };
}
const infinite = p => p.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity).map(a => a.animationName || a.constructor.name));

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const specs = [["desktop 1280×800", bA, { viewport: { width: 1280, height: 800 } }], ["iPhone 13", bB, { ...devices["iPhone 13"] }]];
  const two = twoSame();
  check("našla se partie se dvěma stejnými zvířátky v zásobě", !!two, two ? two.join(",") : "");

  for (const [name, br, opt] of specs) {
    // 1) odezva uprostřed soupeřovy animace
    {
      const id = "pocit00001", o = await mk(br, opt, id, doc(["m74"]));
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#game:not([hidden])");
      await p.waitForTimeout(400);
      check(`${name}: žádná nekonečná animace ve hře`, (await infinite(p)).length === 0, (await infinite(p)).join(","));
      o.put(doc(["m74", "m24"], 6));
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await p.waitForSelector("#fx .ghost", { state: "attached", timeout: 6000 });
      const t0 = Date.now();
      // stopa soupeřova tahu: vidět text, začátek, cíl
      const sub = await p.locator("#sub").innerText();
      check(`${name}: soupeřův tah je vidět jako text (odkud, kam, co sebral)`, /Radka: slon z C4 na B3, bere kuřátko/.test(sub) || /slon z .* na .*bere/.test(sub), sub);
      check(`${name}: poslední tah označen (odkud i kam)`, await p.locator("#board .cell.from").count() === 1 && await p.locator("#board .cell.to").count() === 1);
      // klepnutí přímo v prohlížeči (měření nezkreslí latence Playwrightu, v headless WebKitu jsou snímky pomalé)
      const hit = await p.evaluate(async () => {
        await new Promise(r => setTimeout(r, 150));
        const ghost = !!document.querySelector("#fx .ghost");
        document.querySelector('#board .cell[data-i="11"]').click();
        return { ghost, sel: document.querySelectorAll("#board .cell.sel").length, tg: document.querySelectorAll("#board .cell.target").length, hp: !!document.querySelector("#sub").textContent };
      });
      check(`${name}: výběr figurky a cíle naběhnou hned (ve stejném okamžiku) uprostřed animace`, hit.ghost && hit.sel === 1 && hit.tg > 0, JSON.stringify(hit));
      await p.waitForFunction(() => !document.querySelector("#fx .ghost"), null, { timeout: 6000 });
      const ev = await p.evaluate(() => window.__fxlog);
      const add = ev.find(e => e.k === "+" && /ghost/.test(e.c)), rem = ev.find(e => e.k === "-" && /ghost/.test(e.c));
      const life = rem && add ? Math.round(rem.t - add.t) : -1;
      check(`${name}: přeběhnutí soupeře (stopa + nádech + přelet) skončí do 1,1 s`, life > 0 && life < 1100, `${life} ms`);
      await p.waitForTimeout(500);
      check(`${name}: po animaci je výběr i cíle pořád na desce`, await p.locator("#board .cell.sel").count() === 1 && await p.locator("#board .cell.target").count() > 0);
      check(`${name}: kuřátko je v Radčině zásobě, označené jako poslední zisk`, await p.locator("#seatTop .tray .hp.got").count() + await p.locator("#seatBot .tray .hp.got").count() === 1);
      check(`${name}: žádná chyba JavaScriptu`, o.errs.length === 0, o.errs.join("|"));
      await o.ctx.close();
    }
    // 2) počitadlo v zásobě
    if (two) {
      const id = "pocit00002", o = await mk(br, opt, id, doc(two));
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#game:not([hidden])");
      await p.waitForTimeout(400);
      const info = await p.evaluate(() => [...document.querySelectorAll("#game .tray .hp[data-n]")].map(b => ({ t: b.dataset.t, n: +b.dataset.n, cnt: b.querySelector(".cnt") && b.querySelector(".cnt").textContent, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })));
      const two2 = info.find(i => i.n === 2);
      check(`${name}: dvě stejná zvířátka jsou jeden kámen s počitadlem 2`, !!two2 && two2.cnt === "2", JSON.stringify(info));
      check(`${name}: kámen v zásobě má aspoň 44×44`, info.every(i => i.w >= 44 && i.h >= 44));
      await o.ctx.close();
    }
    // 3) razítko nezakryje, jak partie skončila
    {
      const id = "pocit00003", o = await mk(br, opt, id, doc(["m74", "m24", "dC5", "m03", "m52", "m36", "m21"]));
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#endBox:not([hidden])");
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const h = document.getElementById("hanko").getBoundingClientRect(), t = document.querySelector("#board .cell.win .tile");
        if (!t) return null;
        const a = t.getBoundingClientRect(), cx = h.left + h.width / 2, cy = h.top + h.height / 2, rad = Math.min(h.width, h.height) / 2;
        const nx = Math.max(a.left, Math.min(cx, a.right)), ny = Math.max(a.top, Math.min(cy, a.bottom));
        return { dist: Math.hypot(cx - nx, cy - ny), rad, vis: getComputedStyle(document.getElementById("hanko")).display !== "none" };
      });
      check(`${name}: razítko nezasahuje do vítězné figurky`, !!r && r.dist >= r.rad - 1, r ? `vzdálenost ${Math.round(r.dist)} px, poloměr ${Math.round(r.rad)} px` : "chybí .cell.win");
      check(`${name}: žádná nekonečná animace na konci`, (await infinite(p)).length === 0);
      await o.ctx.close();
    }
    // 4) reduced motion: žádný letící duch, ale stále jasná informace
    {
      const id = "pocit00004", o = await mk(br, { ...opt, reducedMotion: "reduce" }, id, doc(["m74"]));
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#game:not([hidden])");
      await p.waitForTimeout(300);
      o.put(doc(["m74", "m24"], 6));
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await p.waitForFunction(() => /Radka: /.test(document.getElementById("sub").textContent), null, { timeout: 6000 });
      const seen = await p.evaluate(() => document.querySelectorAll("#fx > *").length);
      check(`${name}: reduced motion: žádný efekt nad deskou`, seen === 0);
      check(`${name}: reduced motion: statická informace (text, odkud, kam, zisk v zásobě)`,
        /bere/.test(await p.locator("#sub").innerText()) && await p.locator("#board .cell.from").count() === 1 && await p.locator("#board .cell.to").count() === 1 &&
        await p.locator("#seatTop .tray .hp.got").count() + await p.locator("#seatBot .tray .hp.got").count() === 1);
      await o.ctx.close();
    }
  }
  console.log(`\n${pass} prošlo, ${fail} selhalo`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
