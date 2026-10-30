// Herní jádro Zvířátkového šógi (pravidla viz README.md).
// Deska 3×4, pole i = řádek * 3 + sloupec. Řádek 0 je domov hráče „o“, řádek 3 domov hráče „x“.
// Hráč x táhne „dopředu“ nahoru (řádek − 1), hráč o dolů (řádek + 1).
(function (root) {
  const ROWS = 4, COLS = 3, CELLS = 12;
  const other = p => p === "x" ? "o" : "x";
  // směry ve vlastní orientaci figurky: [řádek, sloupec], záporný řádek = dopředu
  const DIRS = {
    L: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
    G: [[-1, 0], [0, -1], [0, 1], [1, 0]],
    E: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    C: [[-1, 0]],
    H: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]],
  };
  const NAMES = {
    L: { n: "lev", a: "lva", g: "m" },
    G: { n: "žirafa", a: "žirafu", g: "f" },
    E: { n: "slon", a: "slona", g: "m" },
    C: { n: "kuřátko", a: "kuřátko", g: "n" },
    H: { n: "slepice", a: "slepici", g: "f" },
  };
  const goalRow = p => p === "x" ? 0 : ROWS - 1;
  const rc = i => [Math.floor(i / COLS), i % COLS];

  function initial(starter) {
    const b = new Array(CELLS).fill(null);
    let id = 0;
    const put = (i, t, p) => { b[i] = { t, p, id: id++ }; };
    put(0, "G", "o"); put(1, "L", "o"); put(2, "E", "o"); put(4, "C", "o");
    put(7, "C", "x"); put(9, "E", "x"); put(10, "L", "x"); put(11, "G", "x");
    return { b, h: { x: [], o: [] }, turn: starter === "o" ? "o" : "x" };
  }
  const clone = s => ({ b: s.b.map(c => c && { ...c }), h: { x: s.h.x.map(c => ({ ...c })), o: s.h.o.map(c => ({ ...c })) }, turn: s.turn });

  // pole, na která figurka z pole i dosáhne (bez ohledu na obsazenost)
  function reach(s, i) {
    const pc = s.b[i]; if (!pc) return [];
    const [r, c] = rc(i), sg = pc.p === "x" ? 1 : -1, out = [];
    for (const [dr, dc] of DIRS[pc.t]) {
      const r2 = r + dr * sg, c2 = c + dc * sg;
      if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS) out.push(r2 * COLS + c2);
    }
    return out;
  }
  const attacked = (s, i, by) => s.b.some((pc, j) => pc && pc.p === by && reach(s, j).includes(i));

  // tahy: {k:"m", f, to} posun, {k:"d", t, to} položení ze zásoby
  function moves(s, p = s.turn) {
    const out = [];
    s.b.forEach((pc, i) => {
      if (!pc || pc.p !== p) return;
      reach(s, i).forEach(to => { if (!s.b[to] || s.b[to].p !== p) out.push({ k: "m", f: i, to }); });
    });
    const types = [...new Set(s.h[p].map(c => c.t))];
    types.forEach(t => s.b.forEach((c, to) => { if (!c) out.push({ k: "d", t, to }); }));
    return out;
  }
  const same = (a, b) => a.k === b.k && a.to === b.to && (a.k === "m" ? a.f === b.f : a.t === b.t);
  const legal = (s, mv) => moves(s).some(m => same(m, mv));

  // zápis tahu: "m" + odkud + kam, "d" + typ + kam (pole 0–11 jako 0–9, a, b)
  const enc = mv => mv.k === "m" ? "m" + mv.f.toString(12) + mv.to.toString(12) : "d" + mv.t + mv.to.toString(12);
  function dec(str) {
    if (typeof str !== "string" || str.length !== 3) return null;
    const to = parseInt(str[2], 12);
    if (!(to >= 0 && to < CELLS)) return null;
    if (str[0] === "m") { const f = parseInt(str[1], 12); return f >= 0 && f < CELLS ? { k: "m", f, to } : null; }
    if (str[0] === "d" && "GEC".includes(str[1])) return { k: "d", t: str[1], to };
    return null;
  }

  // provede legální tah, vrátí nový stav a co se stalo
  function apply(s0, mv) {
    const s = clone(s0), p = s.turn, info = { mv, p, captured: null, promoted: false, dropped: false, piece: null, from: null, to: mv.to, lionCaught: false, lionHome: false };
    if (mv.k === "d") {
      const k = s.h[p].findIndex(c => c.t === mv.t);
      const c = s.h[p].splice(k, 1)[0];
      s.b[mv.to] = { t: c.t, p, id: c.id };
      info.dropped = true; info.piece = { ...s.b[mv.to] };
    } else {
      const pc = s.b[mv.f], cap = s.b[mv.to];
      info.from = mv.f;
      if (cap) {
        info.captured = { ...cap };
        if (cap.t === "L") info.lionCaught = true;
        else s.h[p].push({ t: cap.t === "H" ? "C" : cap.t, id: cap.id });
      }
      s.b[mv.f] = null;
      const moved = { ...pc };
      if (pc.t === "C" && rc(mv.to)[0] === goalRow(p)) { moved.t = "H"; info.promoted = true; }
      s.b[mv.to] = moved;
      info.piece = { ...moved };
      if (pc.t === "L" && rc(mv.to)[0] === goalRow(p) && !attacked(s, mv.to, other(p))) info.lionHome = true;
    }
    s.turn = other(p);
    return { s, info };
  }

  // klíč pozice pro pravidlo opakování: deska, zásoby a kdo je na tahu
  function key(s) {
    const b = s.b.map(c => c ? (c.p === "x" ? c.t : c.t.toLowerCase()) : "-").join("");
    const h = p => s.h[p].map(c => c.t).sort().join("");
    return b + "|" + h("x") + "|" + h("o") + "|" + s.turn;
  }

  // přehraje celou partii; neplatný tah partii utne (vrátí ok:false)
  // výsledek: { w: "x"|"o"|null, why: "lev"|"cil"|"vzdal"|"opak"|"blok" }
  function play(g) {
    let s = initial(g.s), result = null, last = null, ok = true, prev = null;
    const seen = new Map([[key(s), 1]]);
    for (let n = 0; n < g.m.length; n++) {
      const mv = dec(g.m[n]);
      if (!mv || result || !legal(s, mv)) { ok = false; break; }
      prev = s;
      const r = apply(s, mv);
      s = r.s; last = r.info;
      if (last.lionCaught) result = { w: last.p, why: "lev" };
      else if (last.lionHome) result = { w: last.p, why: "cil" };
      else {
        const k = key(s), c = (seen.get(k) || 0) + 1;
        seen.set(k, c);
        if (c >= 3) result = { w: null, why: "opak" };
        else if (!moves(s).length) result = { w: last.p, why: "blok" };
      }
    }
    if (!result && ok && (g.r === "x" || g.r === "o")) result = { w: other(g.r), why: "vzdal" };
    return { s, prev, last, result, ok, count: seen.get(key(s)) || 1 };
  }

  root.Sogi = { ROWS, COLS, CELLS, DIRS, NAMES, other, goalRow, rc, initial, reach, attacked, moves, legal, enc, dec, apply, key, play };
  if (typeof module !== "undefined") module.exports = root.Sogi;
})(typeof globalThis !== "undefined" ? globalThis : this);
