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

// ---------- varianty začátku kola ----------
const flip = c => 11 - c;
// vynutí hráč na tahu výhru do `d` půltahů (lichý počet)? Prohledává do hloubky s pamětí pozic, opakování pozice neřeší.
// Mimo sadu ověřeno i do 11 půltahů (6 tahů začínajícího): žádná varianta nemá vynucenou výhru.
const imm = r => r.info.lionCaught || r.info.lionHome;
const memo = new Map();
function canWin(s, d) {
  const k = S.key(s) + "#" + d;
  if (memo.has(k)) return memo.get(k);
  let res = false;
  for (const m of S.moves(s)) {
    const r = S.apply(s, m);
    if (imm(r)) { res = true; break; }
    if (d >= 3) {
      const opp = S.moves(r.s);
      if (!opp.length) { res = true; break; }
      if (opp.every(m2 => { const r2 = S.apply(r.s, m2); return !imm(r2) && canWin(r2.s, d - 2); })) { res = true; break; }
    }
  }
  memo.set(k, res);
  return res;
}
const H = require("./pomocne.cjs");
t("5 variant, klasika je výchozí (chybějící i neznámé vr)", () => {
  assert.deepEqual(S.VR_KEYS, ["k", "d", "p", "b", "s"]);
  assert.equal(S.vrOf(undefined), "k"); assert.equal(S.vrOf("zzz"), "k");
  assert.equal(S.key(S.initial("x", "k")), S.key(S.initial("x")));
  assert.equal(S.key(S.initial("x", "zzz")), "gle-c--C-ELG|||x");
  // starý dokument bez vr se přehraje jako klasika
  assert.deepEqual(S.play({ s: "x", m: ["m74", "m24", "dC5", "m03", "m52", "m36", "m21"] }).result, { w: "x", why: "lev" });
  assert.deepEqual(S.play({ s: "x", vr: "k", m: ["m74", "m24", "dC5", "m03", "m52", "m36", "m21"] }).result, { w: "x", why: "lev" });
});
for (const vr of S.VR_KEYS) {
  t(`varianta ${vr} (${S.VARIANTS[vr].n}): souměrná podle středu, stejné zásoby, jedinečná id`, () => {
    for (const st of ["x", "o"]) {
      const s = S.initial(st, vr);
      assert.equal(s.turn, st);
      for (let i = 0; i < 12; i++) {
        const a = s.b[i], b = s.b[flip(i)];
        assert.equal(!!a, !!b, "obsazenost pole " + i);
        if (a) { assert.equal(a.t, b.t); assert.notEqual(a.p, b.p); }
      }
      assert.deepEqual(s.h.x.map(c => c.t), s.h.o.map(c => c.t));
      const all = [...s.b.filter(Boolean), ...s.h.x, ...s.h.o], ids = all.map(c => c.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.equal(all.filter(c => c.t === "L").length, 2);
      // lev každého stojí ve své domácí řadě a nikdo není hned v šachu ani na cíli
      const lx = s.b.findIndex(c => c && c.t === "L" && c.p === "x"), lo = s.b.findIndex(c => c && c.t === "L" && c.p === "o");
      assert.equal(S.rc(lx)[0], 3);
      assert.equal(S.rc(lo)[0], 0);
      assert.equal(S.attacked(s, lx, "o"), false);
      assert.equal(S.attacked(s, lo, "x"), false);
    }
  });
  t(`varianta ${vr}: legální, hratelná, nikdo nevyhraje v jednom tahu ani nevynutí výhru do 9 půltahů (první hráč má bezpečný tah)`, () => {
    for (const st of ["x", "o"]) {
      const s = S.initial(st, vr), ms = S.moves(s);
      assert.ok(ms.length >= 4, "první hráč má co hrát");
      assert.ok(ms.every(m => S.legal(s, m)));
      assert.ok(ms.every(m => !imm(S.apply(s, m))), "žádný tah na vítězství hned");
      assert.ok(S.moves(s, S.other(st)).length >= 4, "druhý hráč má co hrát");
      assert.equal(canWin(s, 9), false, "první hráč nevynutí výhru do 9 půltahů");
      // druhý hráč nevynutí výhru do 9 půltahů po každém prvním tahu (aspoň jeden první tah je bezpečný)
      assert.ok(ms.some(m => !canWin(S.apply(s, m).s, 9)), "první hráč má bezpečný tah");
    }
  });
  t(`varianta ${vr}: play čte g.vr, tahy se přehrají stejně a opakování pozice dál platí`, () => {
    const m = H.winLine(vr, "x", "x");
    const g = S.play({ s: "x", vr, m });
    assert.ok(g.ok); assert.equal(g.result.w, "x"); assert.ok(["lev", "cil"].includes(g.result.why));
    assert.equal(S.play({ s: "o", vr, m: H.winLine(vr, "o", "o") }).result.w, "o");
    const loop = H.loopLine(vr, "x");
    assert.equal(S.play({ s: "x", vr, m: loop }).result, null);
    assert.deepEqual(S.play({ s: "x", vr, m: [...loop, ...loop] }).result, { w: null, why: "opak" });
    assert.equal(S.play({ s: "x", vr, m: ["m77"] }).ok, false);
  });
}
t("Dárek: oba mají kuřátko v zásobě a můžou ho hned položit; Bez kuřátek: deska bez kuřátek; Prohozená křídla; Slepičí start", () => {
  const d = S.initial("x", "d");
  assert.deepEqual(d.h.x.map(c => c.t), ["C"]); assert.deepEqual(d.h.o.map(c => c.t), ["C"]);
  assert.ok(S.moves(d).some(m => m.k === "d" && m.t === "C"));
  const b = S.initial("x", "b");
  assert.equal(b.b.filter(c => c && (c.t === "C" || c.t === "H")).length, 0);
  assert.deepEqual(b.h.x.map(c => c.t), ["C"]);
  const p = S.initial("x", "p");
  assert.equal(p.b[9].t, "G"); assert.equal(p.b[11].t, "E"); assert.equal(p.b[0].t, "E"); assert.equal(p.b[2].t, "G");
  const s = S.initial("x", "s");
  assert.equal(s.b[7].t, "H"); assert.equal(s.b[4].t, "H");
  // sebraná slepice se vrací jako kuřátko
  const r = S.apply(s, { k: "m", f: 7, to: 4 });
  assert.deepEqual(r.s.h.x.map(c => c.t), ["C"]);
});
t("nabídka variant: deterministická ze seedu, dvě různé, bez právě hrané, všechny se časem objeví", () => {
  const seen = new Set();
  for (let n = 2; n < 40; n++) {
    for (const prev of S.VR_KEYS) {
      const a = S.offer("abc123xyz789", n, prev), b = S.offer("abc123xyz789", n, prev);
      assert.deepEqual(a, b);
      assert.equal(a.length, 2); assert.notEqual(a[0], a[1]);
      assert.ok(a.every(v => S.VARIANTS[v] && v !== prev));
      a.forEach(v => seen.add(v));
    }
  }
  assert.equal(seen.size, 5);
  // různé místnosti a různá kola dávají různé nabídky
  const sig = new Set(); for (let i = 0; i < 30; i++) sig.add(S.offer("room" + i, 2, "k").join());
  assert.ok(sig.size >= 4, "nabídky se liší: " + [...sig].join(" "));
  const rounds = new Set(); for (let n = 2; n < 14; n++) rounds.add(S.offer("abc123xyz789", n, "k").join());
  assert.ok(rounds.size >= 3);
});
t("tituly: 0 nic, 1 Učeň, 3 Strážce zásoby, 5 Lví mistr (kosmetika od úrovně 2)", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(S.rank), [0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual(S.RANKS, ["", "Učeň", "Strážce zásoby", "Lví mistr"]);
});
t("bot: vezme vyhrávající tah, nenechá si chytit lva, bere, a partie bota s botem jsou legální a končí", () => {
  const mk = (cells, turn) => { const b = new Array(12).fill(null); let id = 0; cells.forEach(([i, tp, p]) => { b[i] = { t: tp, p, id: id++ }; }); return { b, h: { x: [], o: [] }, turn }; };
  // chycení lva
  const w = mk([[4, "L", "x"], [1, "L", "o"], [11, "G", "o"]], "x");
  for (let k = 0; k < 10; k++) assert.deepEqual(S.bot(w), { k: "m", f: 4, to: 1 });
  // lev do cíle
  const g1 = mk([[3, "L", "x"], [11, "L", "o"]], "x");
  for (let k = 0; k < 10; k++) assert.ok(S.apply(g1, S.bot(g1)).info.lionHome);
  // chycení žirafy by vedlo ke ztrátě lva: bot ho nesebere a lva neodkryje
  const sv = mk([[7, "L", "x"], [3, "G", "o"], [0, "L", "o"]], "x");
  for (let k = 0; k < 60; k++) {
    const m = S.bot(sv), r = S.apply(sv, m);
    assert.ok(!S.moves(r.s).some(m2 => S.apply(r.s, m2).info.lionCaught), "bot nenechá chytit lva: " + S.enc(m));
  }
  // sebrání má přednost před náhodným tahem
  const cp = mk([[4, "G", "x"], [3, "E", "o"], [11, "L", "x"], [0, "L", "o"]], "x");
  for (let k = 0; k < 20; k++) assert.ok(S.apply(cp, S.bot(cp)).info.captured, "bere");
  // celé partie bota s botem jsou legální a končí
  for (let gm = 0; gm < 30; gm++) {
    const st0 = gm % 2 ? "x" : "o", vr = S.VR_KEYS[gm % 5], ms = [];
    let s = S.initial(st0, vr), done = false;
    for (let i = 0; i < 400 && !done; i++) {
      const m = S.bot(s); if (!m) { done = true; break; }
      assert.ok(S.legal(s, m)); ms.push(S.enc(m)); s = S.apply(s, m).s;
      const pl = S.play({ s: st0, vr, m: ms });
      assert.ok(pl.ok); done = !!pl.result;
    }
    assert.ok(done, "partie bota skončila");
  }
});
console.log(`\n${n} testů prošlo`);
