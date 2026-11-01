# Deník – Zvířátkové šógi

PŘEVZATO 1. 11. – kolo vylepšení, session zviratka-kolo (Claude); jiná session sem nepíše.
PŘEVZATO 31. 10.

## 2026-11-01 · Claude, zviratka-kolo (začátečník, výrazy, klíčové momenty, šance na návrat)
- Nejslabší místa z hraní (živě sólo na iPhonu + tri-partie 42/0 před změnami): 1) rámeček „sebereš“ byl po výběru figurky schovaný pod kamenem (refreshSel vkládal .mark pod figurku), 2) začátečník neví, čím začít, 3) lva může soupeř chytit bez varování, prohra pak působí nefér, 4) zvířátka mají jeden výraz, klíčové momenty nemají postavu, 5) šance na návrat v sérii je jen „poražený vybírá a začíná“.
- Hotovo (b2244b2): oprava rámečku; výrazy v SVG (vrstvy fx-n/fear/joy/ko, třídy m-…): ohrožený lev se bojí a potí a jednou se otřese, útočník na mého lva má červený obrys, sebrané zvíře se lekne → odletí s křížky → v nové barvě se usmívá, kdo sebral se zubí, slepice po proměně pyšná + kroužek, na konci vítěz radost / poražený lev strach / chycený lev v zásobě křížky, dopad razítka otřese deskou a vítěz poskočí; průvodce prvním tahem (zs-coach: tahající zvířátka jednou poskočí, rada pod deskou), jednorázová rada k položení (zs-tip-drop), rady „Pozor na lva!“ / „Chyť jeho lva!“ za tahem soupeře (s radou kratší text tahu, ať se vejde na nízký iPhone); kuřátko na útěchu (2 prohry za sebou = kuřátko navíc; engine `consolation`, `initial(…, bonus)`, dokument `h`, `b`; i v sólu).
- Ověřeno lokálně (python http.server 8805): engine 31/0 (nový test útěchy), solo 141/0, dva-prohlizece 46/0, desktop-iphone 159/0, herna 43/0, pocit 29/0, tri-partie 43/0 (nová kontrola kola 4 s kuřátkem na útěchu; jednou 42/1 kontrast „Chci odvetu“ v přechodu barev, známé zakolísání z 31. 10.). Hráčské snímky momentů: scratchpad/momenty.cjs.
- NEOVĚŘENO: skutečný iPhone; zda rady nejsou Markovi otravné (průvodce zmizí po prvním tahu na zařízení, rady o lvu zůstávají).
- Živě po nasazení b2244b2 (Pages, exit 0): tri-partie 43/0, solo 141/0, dva-prohlizece 46/0. herna-zive spadl na `#pas-zalozit` ve stránce Herny (Hernu dnes upravuje jiná session, se Zvířátky nesouvisí); Herna-protokol přes zkušební rodiče lokálně 43/0.
- Design-eye kolo 1 na živém buildu: **PROFI, ale těsně**. Výrazy „mají humor“, sekvence sebrání čistá, kuřátko na útěchu čisté. Opraveno hned: obrys útočníka a strach lva naběhnou až po dopadu soupeřova tahu (dřív dvojitý obrys za letu), telefon na šířku se na konci nedoroluje (deska a razítko zůstanou vidět).
- Nasazeno a723a8b (načasování + rady: průvodce po tahu soupeře mlčí, tah soupeře se zkrátí jen u „Pozor na lva!“ / „Chyť jeho lva!“ / rady k zásobě). Lokálně pocit 29/0, solo 141/0 (2×; jednou 140/1 = náhodně krátká partie, bot 0× v textu), dva-prohlizece 46/0. Živě (exit 0): pocit 29/0, solo 141/0, dva-prohlizece 46/0.
- Dál (nezapracováno): 1) telefon na šířku (750×342): deska a karta vedle sebe, ať je celá vidět; 2) na desktopu výrazy malé (hlavu při m-fear/m-joy krátce zvětšit); 3) panel „Jak se hraje“ na desktopu po prvním tahu sbalit; 4) razítko je text na desce (dřívější kola ho schválila, design-eye teď navrhuje mimo desku), rozhodnutí na Markovi. – dodělává session na účtu P, jiná session sem nepíše.

## 2026-10-31 · Claude (napojení na Hernu + „Zkusit sám“ na iPhonu)
- Hotovo: protokol Herny v1 (meta řádek, `#herna=1…` bez úvodu/výzvy, zprávy pripraveno / stav / vysledek / jina-hra, skryté sdílení a „Zkusit sám“); `tests/herna.cjs` 43/0 (iframe, 2 prohlížeče, falešná síť). Úvod na iPhonu: na nízkém telefonu se skryje řada zvířátek, „Zkusit sám“ je celé vidět (390×664 i 375×667), kontrola v `tests/solo.cjs`.
- Rozhodnuto: zakladatel dokumentu je „x“, `hs` v dokumentu = sedadlo Herny; zakladatel netáhne, dokud druhý nesedí (jinak by se zápisy přebily).
- Testy lokálně (8805): engine 30/0, solo 141/0, tri-partie 42/0, dva-prohlížece 46/0, desktop-iphone 159/0, pocit 28/1 (iPhone přeběhnutí 1107–1122 ms proti 1100; bez mých změn 1597 ms, tedy zátěž stroje).
- Nasazeno 28842f9, Pages build exit 0. Živě (exit 0): herna 43/0 (zkušební rodič, skutečný mantledb), herna-zive 12/0 (skutečná Herna: místnost, výběr hry, partie, skóre v liště a v dokumentu Herny jednou, Jiná hra), solo 141/0, dva-prohlizece 46/0.
- Neověřeno: skutečný iPhone (jen WebKit emulace), Herna na dvou skutečných zařízeních.

## 2026-10-31 · Claude (sólo režim „Zkusit sám“ / #solo)
- Hotovo (a41f850, Pages build exit 0): tlačítko „Zkusit sám“ pod hlavní výzvou, `#solo` otevře rovnou; bot `Sogi.bot` v engine.js (vyhrávající tah, nepustí lva do šachu na 1 tah, bere nejcennější, jinak náhoda; pauza 700–900 ms); `room.solo` = žádná síť, místnost ani zápis do seznamu her, skóre/tituly/lak se nepočítají; štítek `Trénink · Kolo N · Varianta`; konec „Znovu“ / „Vyzvat soupeře“.
- Rozhodnuto: „Vzít tah zpět“ v sólu není (okno ~0,8 s, tlačítko by jen blikalo); kolo 2+ bere náhodnou variantu z `offer`, začátek se střídá.
- Testy lokálně: engine 30/0, dva-prohlížeče 46/0, desktop-iphone 159/0, tri-partie 42/0 (jednou 41/1: kontrast tlačítka v přechodu), solo 111/0, pocit 28/1 (iPhone přeběhnutí 1,15–1,24 s proti limitu 1,1 s, padá stejně i bez mých změn = zatížení stroje). Živě: solo 111/0, dva-prohlížeče 46/0 (napoprvé 45/1 na synchronizaci animace, napodruhé čisté).
- Neověřeno: skutečný iPhone, kvalita bota proti člověku (zkoušen jen bot proti botovi a skriptovaný hráč).

## 2026-10-31 · Claude (převzetí: varianty kola, šance na návrat, postup v sérii)
- Hotovo: 5 souměrných variant (Klasika, Dárek, Prohozená křídla, Bez kuřátek, Slepičí start), 1. kolo vždy Klasika, nabídka 2 variant ze seedu (místnost + kolo); poražený vybírá a zakládá odvetu; tituly Učeň / Strážce zásoby / Lví mistr u jména a v lístku, od 3 výher lakovaný okraj kotouče a hranatá pečeť.
- Rozhodnuto: vítěz odvetu po výhře založit nemůže (dřív mohl a poraženému tak sebral volbu); hra se nezasekne, protože poražený stejně táhne první. Výběr až před prvním tahem jsem zkusil a zahodil: na iPhonu se pod deskou nevejde.
- Opraveno: po odvetě zůstávala stránka na mobilu posunutá dolů (nové kolo teď posune nahoru); nadpis „Začínáš.“ se vejde na řádek.
- Férovost: test zpřísněn na 9 půltahů s pamětí pozic, jednorázově ověřeno do 11 půltahů: žádná varianta nemá vynucenou výhru, začínající má vždy bezpečný tah.
- Testy lokálně (port 8805): engine 29/0, tri-partie 42/0 (4× za sebou), dva-prohlížeče 46/0, desktop-iphone 159/0, pocit 29/0 (vše exit 0).
- Design-eye: kolo 1 „PROFI, ale těsně“ (pečeť vypadala jako kámen a přečnívala desku, výběr varianty splýval s tlačítkem, drobnosti v textu a velikosti), kolo 2 **„PROFI“**; dvě drobnosti z kola 2 také zapracované.
- Testy: audit kontrastu dává přednost vlastnímu pozadí prvku (počitadlo v zásobě byl falešný poplach), kontrast se měří až po doběhnutí animací a přechodů.
- Nasazeno: commit 1f6e3fa, Pages build exit 0. Živě (https://sachasportrezervace-arch.github.io/zviratka-sogi/): tri-partie 42/0, dva-prohlížeče 46/0, desktop-iphone 159/0, pocit 29/0, vše exit 0.
- Neověřeno: skutečný iPhone (jen WebKit emulace), animace zvýraznění titulu jen testem (třída fresh), ne okem.

## 2026-10-31 · Claude (shrnutí dne: pocit ze hry a dvě kola design-eye, nasazeno)
- Pocit ze hry: přeběhnutí zkráceno na ~700 ms (soupeř vidí ~940 ms), oblouková dráha s otočením a změnou barvy, jeden kroužek při úderu, dopad do zásoby s počitadlem, stejná zvířátka v zásobě jako jeden kámen s číslem, stopa soupeřova tahu; odstraněny dekorace (gradienty pozadí, „dýchání“, houpání, lístky, paprsky).
- Design-eye kolo 1 „NENÍ PROFI, ale blízko“ (a90f9c9): poslední tah šedě (červená jen pro sebrání a výhru), výběr a cílové tečky v barvě mé strany, razítko menší a uvnitř desky, nadpisy s word-spacing, jednotné zaoblení 10/14/22, plný přepínač „Kdo začíná“, nová žirafa.
- Kolo 2 „PROFI, ale těsně“ (847f564): žirafa s volným okrajem pro tečky a zaobleným ramenem krku, razítko 36 % s textem min. 14 px, doposunutí k výsledku ~720 ms po razítku, vítězný kámen v barvě týmu, `.seat.on` jako linka místo šedofialové, cílové tečky 75 %, ikona sázky v hlavičce.
- Nasazeno (push a Pages udělal koordinátor), živá stránka obsahuje `art-G`. Živé testy proti GitHub Pages: dva prohlížeče 33/0, desktop+iPhone 143/0, pocit 29/0 (PASS/FAIL); lokálně i engine 10. Finální živé screenshoty: `tests/shots/final/`.
- Neověřeno: skutečný iPhone (headless WebKit je pomalý, plynulost jen z Chromia), vibrace.

## 2026-10-31 · Claude (kolo 3 po kritice design-eye, verdikt „PROFI, ale těsně“)
- Hotovo lokálně: žirafa menší a níž, aby směrové tečky ležely na volném okraji, kratší růžky, krk končí zaobleným ramenem; razítko 36 % a text min. 14 px (`max(14px, 4.6cqi)`, `letter-spacing .02em`); doposunutí k výsledku a Odvetě ~720 ms po startu razítka (v testu v okně do 1,8 s po zobrazení konce); vítězný kámen v barvě týmu s 25% halem (červená jen pro sebrání a razítko); `.seat.on` průhledné s linkou `inset 0 -3px var(--pc)`; cílové tečky 75 % s halem 3 px; „o kafe“ v hlavičce má obrysovou SVG ikonu sázky (hrnek, špendlík, kopeček, klapka, otazník, medaile, vlajka) a váhu 700 v `--sumi`.
- Celkem za den: pocit ze hry (kratší přeběhnutí, stopa soupeře, bez dekorací), dvě kola kritiky design-eye (poslední tah šedě, výběr a cíle v barvě strany, zaoblení 10/14/22, žirafa).
- Testy lokálně: engine 10, dva prohlížeče 33, desktop+iPhone 143, pocit 29.
- Neověřeno: skutečný iPhone.

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
