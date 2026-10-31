// Pomocné funkce testů: scénáře tahů pro libovolnou variantu kola (hledá je engine, takže testy nezávisí na tom,
// jakou variantu nabídl seed místnosti). Použití: const H = require("./pomocne.cjs");
const S = require("../engine.js");

// nejkratší platná řada tahů (zápis jako v dokumentu), po které vyhraje `winner` z důvodu v `why`
// (výchozí: chycení lva nebo lev v cíli). Prochází do šířky, pozice se neopakují.
function winLine(vr, starter, winner, why = ["lev", "cil"], maxPly = 9) {
  const s0 = S.initial(starter, vr);
  let level = [{ s: s0, m: [] }];
  const seen = new Set([S.key(s0)]);
  for (let d = 0; d < maxPly; d++) {
    const next = [];
    for (const n of level) {
      for (const mv of S.moves(n.s)) {
        const r = S.apply(n.s, mv), m = [...n.m, S.enc(mv)];
        const res = r.info.lionCaught ? { w: r.info.p, why: "lev" } : r.info.lionHome ? { w: r.info.p, why: "cil" } : null;
        if (res) { if (res.w === winner && why.includes(res.why)) return m; continue; }
        const k = S.key(r.s);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: r.s, m });
      }
    }
    level = next;
  }
  throw new Error(`žádná řada do ${maxPly} tahů pro ${vr}/${starter}/${winner}/${why}`);
}

// 4 tahy, po kterých je stejná pozice jako na začátku (bez sebrání); dvakrát za sebou = remíza opakováním
function loopLine(vr, starter) {
  const s0 = S.initial(starter, vr), k0 = S.key(s0);
  const quiet = (s, mv) => { const r = S.apply(s, mv); return r.info.captured || r.info.lionHome || r.info.promoted ? null : r; };
  for (const a of S.moves(s0)) {
    const r1 = quiet(s0, a); if (!r1) continue;
    for (const b of S.moves(r1.s)) {
      const r2 = quiet(r1.s, b); if (!r2) continue;
      for (const c of S.moves(r2.s)) {
        const r3 = quiet(r2.s, c); if (!r3) continue;
        for (const d of S.moves(r3.s)) {
          const r4 = quiet(r3.s, d); if (!r4 || S.key(r4.s) !== k0) continue;
          const one = [a, b, c, d].map(S.enc);
          const g = S.play({ s: starter, vr, m: [...one, ...one] });
          if (g.ok && g.result && g.result.why === "opak" && S.play({ s: starter, vr, m: [...one, ...one.slice(0, 3)] }).result === null) return one;
        }
      }
    }
  }
  throw new Error("žádná smyčka pro " + vr);
}

// první tah, který nic nesebere (pro zkoušku „vzít tah zpět“)
function quietMove(vr, starter) {
  const s0 = S.initial(starter, vr);
  const mv = S.moves(s0).find(m => m.k === "m" && !s0.b[m.to]);
  return S.enc(mv);
}

// odveta v prohlížeči: poražený klepne na druhou z nabízených variant (zkouška výběru), pak na odvetu.
// Vrací { offer, pick, pressed, round }. Čekání na novou desku si dělá volající.
async function rematchPick(loser) {
  const offer = await loser.locator("#pickSeg button").evaluateAll(els => els.map(e => e.dataset.vr));
  const pick = offer[1];
  const before = await loser.locator("#pickSeg button[aria-pressed=true]").getAttribute("data-vr");
  await loser.locator(`#pickSeg button[data-vr="${pick}"]`).click();
  const pressed = await loser.locator(`#pickSeg button[data-vr="${pick}"]`).getAttribute("aria-pressed");
  const note = await loser.locator("#pickNote").innerText();
  await loser.click("#endPrimary");
  return { offer, pick, before, pressed, note };
}
const vrOf = p => p.locator("#kolo").getAttribute("data-vr");
const koloText = p => p.locator("#kolo").innerText();
const roomOf = url => url.split("#r.")[1];

module.exports = { winLine, loopLine, quietMove, rematchPick, vrOf, koloText, roomOf };
