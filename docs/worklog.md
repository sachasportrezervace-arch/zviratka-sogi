# Deník – Zvířátkové šógi

## 2026-10-30 · Claude (session z Psaníčka)
- Hotovo: hra postavená a nasazená, https://sachasportrezervace-arch.github.io/zviratka-sogi/ (repo sachasportrezervace-arch/zviratka-sogi, Pages z main /).
- Pravidla ověřena z anglické Wikipedie (Dōbutsu shōgi), viz README. Jádro `engine.js`, 10 testů `node tests/engine.test.cjs`.
- E2E: `node tests/dva-prohlizece.cjs <URL>` (Chromium Pixel 7 + WebKit iPhone 13 + přihlížející), 33 kontrol.
- Opraveno během testu: přijetí výzvy zvedalo počítadlo `v` a první tah zakladatele se odmítal jako konflikt; přijetí rušilo výběr figurky.
- Pozor: port 8765 používá Kafíčko, Zvířátka testovat na 8791.
- Otevřené: nic blokujícího. Možné vylepšení: zvuk, tmavý režim neprošel vizuální kontrolou (jen kontrast tlačítek).
