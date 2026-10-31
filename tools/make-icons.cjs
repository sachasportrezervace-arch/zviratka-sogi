// Vyrobí ikony aplikace (lev na dřevěném kameni s indigovým okrajem) z vlastní kresby lva ze hry.
// node tools/make-icons.cjs   -> icons/icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png (180)
const fs = require("fs"), path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium } = require(PW);

const INK = "#2A221D";
const st0 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const eyes = (y, dx) => `<circle cx="${50 - dx}" cy="${y}" r="3" fill="${INK}"/><circle cx="${50 + dx}" cy="${y}" r="3" fill="${INK}"/><circle cx="${50 - dx + 1}" cy="${y - 1}" r="1" fill="#fff"/><circle cx="${50 + dx + 1}" cy="${y - 1}" r="1" fill="#fff"/>`;
const blush = (y, dx) => `<ellipse cx="${50 - dx}" cy="${y}" rx="4.6" ry="2.6" fill="#EE8C82" opacity=".75"/><ellipse cx="${50 + dx}" cy="${y}" rx="4.6" ry="2.6" fill="#EE8C82" opacity=".75"/>`;
function mane() {
  let s = "";
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; s += `<circle cx="${(50 + Math.cos(a) * 29).toFixed(1)}" cy="${(53 + Math.sin(a) * 29).toFixed(1)}" r="11" fill="#E39B3A" ${st0}/>`; }
  return s + `<circle cx="50" cy="53" r="30" fill="#E39B3A"/>`;
}
const lion = mane() +
  `<circle cx="34" cy="35" r="7" fill="#F6D08A" ${st0}/><circle cx="66" cy="35" r="7" fill="#F6D08A" ${st0}/>` +
  `<circle cx="50" cy="55" r="22" fill="#F6D08A" ${st0}/>` + eyes(51, 8.5) + blush(60, 13) +
  `<path d="M45.5 57.5 Q50 55 54.5 57.5 Q50 63 45.5 57.5Z" fill="#7A3B2A"/><path d="M44 64.5 Q47 67.5 50 63.5 Q53 67.5 56 64.5" fill="none" ${st0} stroke-width="2.4"/>`;

// 512 × 512, celá plocha vyplněná (iOS si rohy zaobluje sám, maskable ikona se ořezává).
// Kámen zabírá 72 % plochy, aby lev ležel v bezpečné zóně.
const T = 72, off = (100 - T) / 2;       // v procentech plochy
const px = v => (v * 5.12).toFixed(2);
const tile = { x: px(off), y: px(off), w: px(T), r: px(T * .19), bar: px(T * .08) };
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="w" x1="0" y1="0" x2=".45" y2="1"><stop offset="0" stop-color="#FCF2DF"/><stop offset=".45" stop-color="#F8EAD0"/><stop offset="1" stop-color="#EFD9B0"/></linearGradient>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34569C"/><stop offset="1" stop-color="#27427F"/></linearGradient>
<clipPath id="c"><rect x="${tile.x}" y="${tile.y}" width="${tile.w}" height="${tile.w}" rx="${tile.r}"/></clipPath>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#0B1630" flood-opacity=".45"/></filter>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
<g filter="url(#sh)"><rect x="${tile.x}" y="${tile.y}" width="${tile.w}" height="${tile.w}" rx="${tile.r}" fill="url(#w)"/></g>
<g clip-path="url(#c)"><rect x="${tile.x}" y="${(parseFloat(tile.y) + parseFloat(tile.w) - parseFloat(tile.bar)).toFixed(2)}" width="${tile.w}" height="${tile.bar}" fill="#2D4C8F"/></g>
<rect x="${tile.x}" y="${tile.y}" width="${tile.w}" height="${tile.w}" rx="${tile.r}" fill="none" stroke="#2D4C8F" stroke-width="${px(.9)}"/>
<g transform="translate(${(parseFloat(tile.x) + parseFloat(tile.w) * .08).toFixed(2)} ${(parseFloat(tile.y) + parseFloat(tile.w) * .035).toFixed(2)}) scale(${(parseFloat(tile.w) * .84 / 100).toFixed(4)})">${lion}</g>
</svg>`;

(async () => {
  const dir = path.join(__dirname, "..", "icons");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "icon.svg"), svg);
  const b = await chromium.launch();
  for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
    const page = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:#2D4C8F}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(dir, name), clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    console.log("icons/" + name, size + "×" + size);
  }
  await b.close();
})();
