// Finální rendery pro kritiku designu do tests/shots/review/ (falešná síť, žádný zápis do mantledb.sh).
// node tests/render-review.cjs [URL]   (výchozí http://127.0.0.1:8791/)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const URL = process.argv[2] || "http://127.0.0.1:8791/";
const OUT = process.env.OUT || path.join(__dirname, "shots", "review");
fs.mkdirSync(OUT, { recursive: true });
const key = id => `https://mantledb.sh/v2/zviratka-${id}/hra`;
const doc = (m, extra = {}, v = 5) => JSON.stringify({ app: "zviratka", v, sx: "dx", so: "do", g: { x: "Mark", o: "Radka", s: "x", m, t: null, k: "1", kc: "", w: [0, 0], r: "" }, ...extra });
// partie s plnou zásobou: Mark má v ruce dvě kuřátka a žirafu, Radka žirafu (hledáno enginem)
const FULL = ["m74", "m03", "ma6", "m14", "m63", "dC8", "mb8", "m48"];
const LIVE_A = ["m74"], LIVE_B = ["m74", "m24"];
const END = ["m74", "m24", "dC5", "m03", "m52", "m36", "m21"];
const END_LIVE = END.slice(0, -1);

async function mk(browser, opt, id, d, me) {
  const ctx = await browser.newContext(opt), store = { [key(id)]: d }, page = await ctx.newPage();
  await page.route("https://mantledb.sh/**", route => {
    const r = route.request(), u = r.url();
    if (r.method() === "GET") return route.fulfill(store[u] ? { status: 200, contentType: "application/json", body: store[u] } : { status: 404, body: "" });
    if (r.method() === "POST") { store[u] = r.postData(); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    route.continue();
  });
  if (me) await page.addInitScript(([i, m]) => localStorage.setItem("zs-r-" + i, m), [id, me]);
  return { ctx, page, put: d2 => { store[key(id)] = d2; } };
}
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + ".png") });

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const targets = [
    ["d", bA, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, ""],
    ["m", bB, { ...devices["iPhone 13"] }, ""],
    ["m-tmavy", bB, { ...devices["iPhone 13"], colorScheme: "dark" }, "dark"],
  ];
  for (const [pre, br, opt, mode] of targets) {
    const dark = mode === "dark", pid = pre.replace(/-/g, "");
    if (!dark) {
      // 1) založení hry
      {
        const o = await mk(br, opt, "rv" + pid + "set", doc([]));
        await o.page.goto(URL);
        await o.page.waitForSelector("#setup:not([hidden])");
        await o.page.fill("#nameX", "Mark"); await o.page.fill("#nameO", "Radka");
        await o.page.selectOption("#stakeSel", "1");
        await shot(o.page, `${pre}-01-setup`);
        await o.ctx.close();
      }
      // 2) výzva
      {
        const o = await mk(br, opt, "rv" + pid + "vyz", doc([], { so: "" }));
        await o.page.goto(URL + "#r.rv" + pid + "vyz");
        await o.page.waitForSelector("#intro:not([hidden])");
        await o.page.waitForTimeout(300);
        await shot(o.page, `${pre}-02-vyzva`);
        await o.ctx.close();
      }
    }
    // 3) partie: vybraná figurka a plná zásoba
    {
      const id = "rv" + pid + "hra" + (dark ? "d" : "l");
      const o = await mk(br, opt, id, doc(FULL), "x");
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#game:not([hidden])");
      await p.waitForTimeout(500);
      // vyber figurku, která má cíle
      const cells = await p.locator("#board .cell").evaluateAll(els => els.filter(e => /tvoje/.test(e.getAttribute("aria-label"))).map(e => +e.dataset.i));
      let picked = false;
      for (const i of cells) {
        await p.locator(`#board .cell[data-i="${i}"]`).click();
        if (await p.locator("#board .cell.target").count()) { picked = true; break; }
      }
      await p.waitForTimeout(450);
      await shot(p, `${pre}-03-partie-vyber-zasoba`);
      console.log(pre, "partie: figurka s cíli vybrána:", picked, "kameny v zásobách:", await p.locator("#game .tray .hp").count());
      await o.ctx.close();
    }
    // 4) přeběhnutí uprostřed letu (soupeřův tah, animace zastavené v daném čase od začátku):
    //    04b = otočení v půlce (nová barva už vidět, kámen z boku), 04 = let k zásobě
    {
      const id = "rv" + pid + "bez" + (dark ? "d" : "l");
      const o = await mk(br, opt, id, doc(LIVE_A), "x");
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#game:not([hidden])");
      await p.waitForTimeout(400);
      o.put(doc(LIVE_B, {}, 6));
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await p.waitForSelector("#fx .ghost", { state: "attached", timeout: 8000 });
      await p.waitForTimeout(420);                  // až se duch odkryje (úder v 350 ms), pak animace zastavíme
      const at = async (ms, name) => {
        await p.evaluate(t => { document.querySelectorAll("#fx .burst").forEach(e => e.remove()); document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); }, ms);
        await p.waitForTimeout(250);
        await shot(p, name);
      };
      if (!dark) await at(540, `${pre}-04b-prebehnuti-otoceni`);
      await at(dark ? 540 : 650, `${pre}-04-prebehnuti-uprostred`);
      await o.ctx.close();
    }
    // 5) konec s razítkem
    {
      const id = "rv" + pid + "kon" + (dark ? "d" : "l");
      const o = await mk(br, opt, id, doc(END), "x");
      const p = o.page;
      await p.goto(URL + "#r." + id);
      await p.waitForSelector("#endBox:not([hidden])");
      await p.waitForTimeout(900);
      await shot(p, `${pre}-05-konec-razitko`);
      await o.ctx.close();
    }
    // 5a/5b) konec po dohrání naživo. 5a: razítko zastavené uprostřed dopadu (jiný stav než statické 05),
    //        5b: na úzkém displeji se stránka po razítku doposune k výsledku a tlačítku odvety
    if (pre === "m") {
      for (const [k, stop] of [["a", true], ["b", false]]) {
        const id = "rv" + pid + "kon2" + k;
        const o = await mk(br, opt, id, doc(END_LIVE), "x");
        const p = o.page;
        if (stop) await p.addInitScript(() => { window.scrollBy = () => {}; });
        await p.goto(URL + "#r." + id);
        await p.waitForSelector("#game:not([hidden])");
        await p.waitForTimeout(500);
        await p.locator('#board .cell[data-i="2"]').click();
        await p.locator('#board .cell[data-i="1"]').click();
        await p.waitForSelector("#endBox:not([hidden])", { timeout: 8000 });
        if (stop) {
          await p.evaluate(() => { const an = document.getElementById("hanko").getAnimations()[0]; an.pause(); an.currentTime = an.effect.getTiming().delay + 170; });
          await p.waitForTimeout(250);
          await shot(p, `${pre}-05a-razitko-dopad`);
        } else {
          await p.waitForTimeout(3500);
          await shot(p, `${pre}-05b-konec-po-doposunuti`);
          console.log(pre, "po doposunutí scrollY:", await p.evaluate(() => Math.round(scrollY)), "odveta v okně:", await p.evaluate(() => document.getElementById("endPrimary").getBoundingClientRect().bottom <= innerHeight));
        }
        await o.ctx.close();
      }
    }
  }
  await bA.close(); await bB.close();
  console.log("hotovo", OUT);
})().catch(e => { console.error(e); process.exit(1); });
