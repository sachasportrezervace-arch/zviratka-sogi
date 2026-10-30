// node tests/engine.test.cjs – kontrola pravidel bez prohlížeče
const S = require("../engine.js");
const assert = require("assert");
let n = 0;
const t = (name, f) => { f(); n++; console.log("ok", name); };
const g = (s, m, r) => S.play({ s, m, r });

t("výchozí rozestavení", () => {
  const s = S.initial("x");
  assert.equal(S.key(s), "gle-c--C-ELG|||x");
});
t("tahy na začátku: x má 4 tahy (kuřátko, žirafa, lev ×2… )", () => {
  const m = S.moves(S.initial("x")).map(S.enc).sort();
  // kuřátko 7→4 (sebere), žirafa 11→8, lev 10→6 (a6), 10→8 (a8), slon 9→6? slon šikmo z (3,0) na (2,1)=7 vlastní → nic
  assert.deepEqual(m, ["m74", "ma6", "ma8", "mb8"].sort());
});
t("partie 1: sebrání, položení, proměna, chycení lva", () => {
  const m = ["m74", "m24", "dC5", "m03", "m52", "m36", "m21"];
  const r = g("x", m);
  assert.ok(r.ok);
  assert.deepEqual(r.result, { w: "x", why: "lev" });
  const p5 = S.play({ s: "x", m: m.slice(0, 5) });
  assert.equal(p5.last.promoted, true);
  assert.equal(p5.s.b[2].t, "H");
  const p3 = S.play({ s: "x", m: m.slice(0, 3) });
  assert.equal(p3.last.dropped, true);
  assert.equal(p3.s.h.x.length, 0);
  const p2 = S.play({ s: "x", m: m.slice(0, 2) });
  assert.equal(p2.last.captured.t, "C");
  assert.deepEqual(p2.s.h.o.map(c => c.t), ["C"]);
});
t("partie 2: lev v cíli (o začíná)", () => {
  const m = ["m15", "ma6", "m58", "m63", "m8b"];
  const r = g("o", m);
  assert.ok(r.ok);
  assert.deepEqual(r.result, { w: "o", why: "cil" });
  assert.deepEqual(r.s.h.o.map(c => c.t), ["G"]);
});
t("lev v cíli pod útokem nevyhrává", () => {
  // o lev 1→5→8, x nechá žirafu na 11; lev sebere žirafu na 11, ale x lev stojí na 10 a útočí
  const r = g("o", ["m15", "m74", "m58", "m97", "m8b"]);
  assert.ok(r.ok);
  assert.equal(r.result, null);
});
t("opakování pozice potřetí = remíza", () => {
  const loop = ["mb8", "m03", "m8b", "m30"];
  assert.equal(g("x", loop).result, null);
  const r = g("x", loop.concat(loop));
  assert.deepEqual(r.result, { w: null, why: "opak" });
});
t("slepice se vrací jako kuřátko", () => {
  const r = g("x", ["m74", "m24", "dC5", "m03", "m52", "m12"]);
  assert.ok(r.ok);
  assert.deepEqual(r.s.h.o.map(c => c.t).sort(), ["C", "C"]);
});
t("kuřátko položené na poslední řadu se nepromění a nehne", () => {
  // x sebere kuřátko a položí ho rovnou na řadu 0? řada 0 je plná, uvolníme pole 0 žirafou
  const r = g("x", ["m74", "m03", "dC0"]);
  assert.ok(r.ok, "tahy platí");
  assert.equal(r.s.b[0].t, "C");
  assert.equal(S.reach({ ...r.s }, 0).length, 0);
});
t("neplatný tah partii utne", () => {
  assert.equal(g("x", ["m77"]).ok, false);
  assert.equal(g("x", ["m03"]).ok, false); // táhne figurka soupeře
});
t("vzdání", () => {
  assert.deepEqual(g("x", ["m74"], "o").result, { w: "x", why: "vzdal" });
});
console.log(`\n${n} testů prošlo`);
