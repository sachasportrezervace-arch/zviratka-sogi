# Deník – Zvířátkové šógi

## 2026-10-31 · Claude (kolo 2 po kritice design-eye)
- Hotovo lokálně, **nenasazeno a nepushnuto**: poslední tah neutrálně šedý (červená jen pro „sebereš“, razítko, výhru), výběr výrazný ve světlém i tmavém režimu bez závislosti na barvě strany, cílové tečky v barvě mé strany, razítko 32 % šířky uvnitř rámu desky a mimo vítězný tah, nadpisy s word-spacing, úvodní kameny v barvě mé strany, přepínač „Kdo začíná“ plný, „nepovinné“ na řádku s popiskem, zaoblení 10/14/22, nová žirafa, pás `.seat.on` z barvy hráče, focus polí uvnitř.
- Testy: engine 10, dva prohlížeče 33, desktop+iPhone 143, pocit 29. Jednou spadl desktop-iphone na časový limit při souběžném běhu s ostatními testy, samostatně opakovaně zelený.
- Neověřeno: skutečný iPhone; na žirafě se směrové tečky v malé zásobě částečně kryjí s růžky a krkem.

## 2026-10-31 · Claude (pocit ze hry, bez dekorací)
- Hotovo lokálně, **nenasazeno a nepushnuto** (čeká na nezávislou kritiku designu): přeběhnutí zkráceno z ~1250 na ~700 ms u toho, kdo táhne (soupeř vidí ~940 ms včetně 240 ms „nádechu“), oblouková dráha, otočení a změna barvy na místě, úder jako jeden kroužek, dopad do zásoby s kroužkem a počitadlem; stejná zvířátka v zásobě jsou jeden kámen s číslem; stopa soupeřova tahu (čára odkud–kam, rámeček cíle, text „Radka: slon z C4 na B3, bere kuřátko.“); výběr figurky a cíle se mění na místě, takže naběhnou hned i uprostřed animace (dřív až po ní); proměna ukáže kuřátko a uprostřed otočení slepici; razítko sedne na prázdné pole nejdál od posledního tahu a vítězná figurka má červený rámeček; výsledek se ukáže až po dohrání tahu, na úzkém displeji se stránka po razítku doposune k tlačítku odvety.
- Odstraněno jako dekorace: radiální gradienty pozadí, „dýchající“ kroužek na kotouči hráče, houpání zvířátek na úvodních obrazovkách, okvětní lístky při proměně, paprsky při sebrání, gradient cílové řady, „×“ jako oddělovač (teď „proti“).
- Testy: engine 10, dva prohlížeče 33, desktop+iPhone 143 (jedna kontrola konce partie záměrně změněna, viz test), nový `tests/pocit.cjs` 29.
- Neověřeno: skutečný iPhone (headless WebKit má pomalé snímky, plynulost animace jen z Chromia), vibrace, rychlost dotazování 2,5 s (největší brzda tempa, nezměněno, neznám limity mantledb.sh).

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
