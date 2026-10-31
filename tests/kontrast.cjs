// Kontrola kontrastu textů v běžící stránce (WCAG: 4,5:1, velké písmo 3:1). Gradienty se nahrazují typickou barvou. Použití: page.evaluate(`(${audit})()`)
module.exports = function auditInPage() {
  const parse = c => {
    let m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
    m = /^color\(srgb ([^)]+)\)$/.exec(c);
    if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]; }
    return null;
  };
  const over = (fg, bg) => { const a = fg[3]; return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
  const special = el => {
    if (el.closest(".tray")) return [235, 211, 164, 1];
    if (el.closest(".fold")) return [248, 234, 208, 1];
    if (el.closest(".hanko")) return [245, 233, 210, 1];
    if (el.closest(".board")) return [216, 207, 158, 1];
    return null;
  };
  const bgOf = el => {
    const sp = special(el); if (sp) return sp;
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const bg = parse(getComputedStyle(e).backgroundColor);
      if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] === 1) break; }
    }
    let base = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const out = [], seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || seen.has(el)) continue;
    if (el.closest("[hidden],.sr,script,style") ) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue;
    // dialog zavřený
    const dlg = el.closest("dialog"); if (dlg && !dlg.open) continue;
    seen.add(el);
    let fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el); fg = over(fg, bg);
    let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op < 1) fg = over([fg[0], fg[1], fg[2], op], bg);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5, rt = ratio(fg, bg);
    if (rt < need) out.push(`${rt.toFixed(2)} < ${need}  "${t.slice(0, 40)}"  <${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").join(".") : ""}>  ${cs.color}`);
  }
  return out;
};
