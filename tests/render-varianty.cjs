// Rendery pro kritiku designu (varianty kola, výběr varianty, skóre s titulem) do tests/shots/review-varianty/.
// Falešná síť, žádný zápis do mantledb.sh. node tests/render-varianty.cjs [URL]   (výchozí http://127.0.0.1:8791/)
const path = require("path");
const fs = require("fs");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const H = require("./pomocne.cjs");
const URL = process.argv[2] || "http://127.0.0.1:8791/";
const OUT = process.env.OUT || path.join(__dirname, "shots", "review-varianty");
fs.mkdirSync(OUT, { recursive: true });
const key = id => `https://mantledb.sh/v2/zviratka-${id}/hra`;
const doc = (g, v = 9) => JSON.stringify({ app: "zviratka", v, sx: "dx", so: "do", g: { x: "Mark", o: "Radka", s: "x", m: [], t: null, k: "1", kc: "", w: [0, 0], r: "", vr: "k", n: 1, ...g } });

async function mk(browser, opt, id, d, me) {
  const ctx = await browser.newContext(opt), store = { [key(id)]: d }, page = await ctx.newPage();
  await page.route("https://mantledb.sh/**", route => {
    const r = route.request(), u = r.url();
    if (r.method() === "GET") return route.fulfill(store[u] ? { status: 200, contentType: "application/json", body: store[u] } : { status: 404, body: "" });
    if (r.method() === "POST") { store[u] = r.postData(); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    route.continue();
  });
  if (me) await page.addInitScript(([i, m]) => localStorage.setItem("zs-r-" + i, m), [id, me]);
  return { ctx, page };
}
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + ".png") });
// jako při hře naživo: na úzkém displeji se stránka po konci doposune, aby byl vidět výsledek a tlačítko odvety
const toEnd = p => p.evaluate(() => { const b = document.getElementById("endBox"), over = b.getBoundingClientRect().bottom + 12 - innerHeight; if (over > 0) window.scrollBy(0, over); });

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const targets = [
    ["d", bA, { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
    ["m", bB, { ...devices["iPhone 13"] }],
    ["m-tmavy", bB, { ...devices["iPhone 13"], colorScheme: "dark" }],
  ];
  const info = [];
  for (const [pre, br, opt] of targets) {
    const pid = pre.replace(/-/g, "");
    // 1) začátek kola s variantou (kolo 3, Prohozená křídla); na mobilu i ostatní varianty se zásobou
    const starts = pre === "d" ? [["p"]] : pre === "m" ? [["p"], ["d"], ["b"], ["s"]] : [["p"], ["b"]];
    for (const [vr] of starts) {
      const id = `rv${pid}st${vr}`;
      const o = await mk(br, opt, id, doc({ vr, n: 3, w: [1, 1], s: "o" }), "x");
      await o.page.goto(URL + "#r." + id);
      await o.page.waitForSelector("#game:not([hidden])");
      await o.page.waitForTimeout(500);
      await shot(o.page, `${pre}-01-kolo-${vr}`);
      const m = await o.page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { ih: innerHeight, kolo: document.getElementById("kolo").textContent, bot: Math.round(r("#seatBot").bottom), status: Math.round(r("#status").bottom), sy: scrollY, sw: document.documentElement.scrollWidth <= innerWidth }; });
      info.push(`${pre} ${vr}: ${JSON.stringify(m)}`);
      await o.ctx.close();
    }
    // 2) konec partie, poražený vybírá z dvou nabídnutých variant (Radka prohrála, výhry 1 : 0 -> titul Učeň)
    {
      const id = `rv${pid}vyb`, m = H.winLine("k", "x", "x");
      const o = await mk(br, opt, id, doc({ m, n: 1, w: [0, 0] }), "o");
      await o.page.goto(URL + "#r." + id);
      await o.page.waitForSelector("#endBox:not([hidden])");
      await o.page.waitForTimeout(2800);
      await toEnd(o.page);
      await shot(o.page, `${pre}-02-vyber-varianty`);
      info.push(`${pre} výběr: ${JSON.stringify(await o.page.evaluate(() => ({ seg: [...document.querySelectorAll("#pickSeg button")].map(b => b.textContent), prim: document.getElementById("endPrimary").getBoundingClientRect().bottom <= innerHeight, ih: innerHeight, sy: scrollY })))}`);
      await o.ctx.close();
    }
    // 3) skóre s titulem: Mark vyhrává třetí partii v sérii (Strážce zásoby, lakovaný okraj, hranaté razítko); 3a = chvíli po zobrazení (zvýrazněný titul), 3b = po utichnutí
    {
      const id = `rv${pid}tit`, m = H.winLine("d", "x", "x");
      const o = await mk(br, opt, id, doc({ m, vr: "d", n: 3, w: [2, 0] }), "x");
      await o.page.goto(URL + "#r." + id);
      await o.page.waitForSelector("#endBox:not([hidden])");
      await o.page.waitForTimeout(700);
      await toEnd(o.page);
      await shot(o.page, `${pre}-03a-skore-titul-zvyrazneny`);
      await o.page.waitForTimeout(2600);
      await shot(o.page, `${pre}-03b-skore-titul`);
      await o.ctx.close();
    }
    // 4) první výhra (Učeň, bez kosmetiky) – srovnání, že odměna od 3 výher je znát
    {
      const id = `rv${pid}uce`, m = H.winLine("k", "x", "x");
      const o = await mk(br, opt, id, doc({ m, n: 1, w: [0, 0] }), "x");
      await o.page.goto(URL + "#r." + id);
      await o.page.waitForSelector("#endBox:not([hidden])");
      await o.page.waitForTimeout(2800);
      await toEnd(o.page);
      await shot(o.page, `${pre}-04-skore-ucen`);
      await o.ctx.close();
    }
  }
  console.log(info.join("\n"));
  await bA.close(); await bB.close();
  console.log("hotovo", OUT);
})().catch(e => { console.error(e); process.exit(1); });
