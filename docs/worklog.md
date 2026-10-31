# Deník – Zvířátkové šógi

## 2026-10-31 · Claude (plocha, celá obrazovka, rozvržení, tmavý režim)
- Hotovo (commit f52c350, nasazeno): tlačítko celé obrazovky v hlavičce (Fullscreen API, ikona i popisek podle stavu, na iPhonu nápověda „Přidat na plochu“, v aplikaci z plochy skryté), `manifest.webmanifest` (standalone, bez `start_url`), ikony 192/512/180 (`tools/make-icons.cjs`), apple meta, pole „Vlož odkaz na hru“ v aplikaci z plochy bez her, tlačítka „Jsem …“ i u skončené partie.
- Rozvržení změřené: mobil 390×664 `#seatBot` bottom 600/664, 375×667 603/667, 390×844 663/844 (deska 311/313/358 px); desktop 1280×800 752/800, 1440×900 852/900 (deska 426/501 px, pravidla vpravo). Žádné vodorovné posouvání.
- Tmavý režim: kontrast textů v barvách hráčů (tokeny `--ai-t`, `--kaki-t`, `--hanko-t`), „zásoba je prázdná“ (i ve světlém), pozadí bez šedé mlhy, focus, obrys desky a zásob. `impeccable detect`: jen záměrné tatami pruhy.
- Chyba nalezená testem: `display-mode: fullscreen` schovával tlačítko hned po vstupu do celé obrazovky, takže z ní nešlo vyjít. Teď se kontroluje jen `standalone`.
- Testy: `node tests/desktop-iphone.cjs` (143 kontrol, desktop Chromium proti WebKit iPhone 13) a `tests/dva-prohlizece.cjs` (33) zelené lokálně i na živé URL.
- Neověřeno: skutečný iPhone (Sdílet → Přidat na plochu, vzhled stavového řádku `default`, `navigator.standalone`), skutečný Safari bez Fullscreen API. Headless Chromium fullscreen zvládl.

## 2026-10-30 · Claude (session z Psaníčka)
- Hotovo: hra postavená a nasazená, https://sachasportrezervace-arch.github.io/zviratka-sogi/ (repo sachasportrezervace-arch/zviratka-sogi, Pages z main /).
- Pravidla ověřena z anglické Wikipedie (Dōbutsu shōgi), viz README. Jádro `engine.js`, 10 testů `node tests/engine.test.cjs`.
- E2E: `node tests/dva-prohlizece.cjs <URL>` (Chromium Pixel 7 + WebKit iPhone 13 + přihlížející), 33 kontrol.
- Opraveno během testu: přijetí výzvy zvedalo počítadlo `v` a první tah zakladatele se odmítal jako konflikt; přijetí rušilo výběr figurky.
- Pozor: port 8765 používá Kafíčko, Zvířátka testovat na 8791.
- Otevřené: nic blokujícího. Možné vylepšení: zvuk, tmavý režim neprošel vizuální kontrolou (jen kontrast tlačítek).
