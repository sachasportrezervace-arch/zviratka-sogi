# Zvířátkové šógi

Živá hra pro dva na jednom odkazu: https://sachasportrezervace-arch.github.io/zviratka-sogi/

Malá japonská hra na desce 3 × 4 (lev, žirafa, slon, kuřátko). Vlastní název, vlastní kresby zvířátek (SVG v `index.html`).
Architektura a synchronizace převzaté z Psaníčka: statická stránka na GitHub Pages, stav partie v JSON dokumentu na
`mantledb.sh` (bez účtu), odkaz `#r.<id>`, dotazování každé 2,5 s, zápis s kontrolou počítadla `v`.

## Soubory

- `index.html` – celá hra (vzhled, kresby, místnost, animace).
- `engine.js` – pravidla: tahy, sebrání, položení, proměna, výhra, opakování pozice; varianty kola (`VARIANTS`, `offer`) a tituly (`RANKS`, `rank`).
- `tests/engine.test.cjs` – 29 testů pravidel, variant a titulů včetně férovosti (žádná vynucená výhra do 9 půltahů): `node tests/engine.test.cjs`
- `tests/tri-partie.cjs` – playtest 4 kol za sebou (Chromium desktop + WebKit iPhone 13, falešná sdílená síť): kola se liší, poražený vybírá,
  vítěz odvetu založit nemůže, tituly, lakovaný okraj, hranaté razítko, kontrast, rozvržení: `node tests/tri-partie.cjs [URL]` (snímky `tests/shots/tri-partie/`)
- `tests/render-varianty.cjs` – rendery variant, výběru a titulů pro kritiku designu do `tests/shots/review-varianty/`
- `tests/pomocne.cjs` – scénáře tahů pro libovolnou variantu (hledá je engine) a odveta s výběrem varianty.
- `tests/dva-prohlizece.cjs` – celá série ve 2 prohlížečích (Chromium jako Pixel 7, WebKit jako iPhone 13) + přihlížející:
  `node tests/dva-prohlizece.cjs https://sachasportrezervace-arch.github.io/zviratka-sogi/`
- `tests/desktop-iphone.cjs` – desktop Chromium 1280×800 (Mark) proti WebKitu s `devices["iPhone 13"]` na výšku (Radka): celá série partií,
  měření rozvržení (`getBoundingClientRect` proti `innerHeight`, dotykové cíle ≥ 44 px, žádné vodorovné posouvání) pro 390×664, 375×667,
  390×844, 1280×800 a 1440×900, fullscreen, nápověda „Přidat na plochu“, manifest a ikony (HTTP 200), aplikace z plochy (vložení odkazu),
  tmavý režim (snímky všech obrazovek + kontrola kontrastu textů) a chyby JavaScriptu: `node tests/desktop-iphone.cjs [URL]`.
  Rozvržení a tmavý režim běží nad falešnou sítí (route na mantledb.sh), partie nad skutečnou. Snímky jdou do `tests/shots` (proměnná `SHOTS`).
- `tests/kontrast.cjs` – pomocná kontrola kontrastu textů pro předchozí test.
- `tests/pocit.cjs` – pocit ze hry (29 kontrol, Chromium desktop + WebKit iPhone 13, falešná síť): výběr a cíle naběhnou hned i uprostřed animace soupeřova tahu,
  délka přeběhnutí, text a značky posledního tahu, počitadlo stejných zvířátek v zásobě, razítko mimo vítěznou figurku, žádná nekonečná animace, reduced motion.
  `node tests/pocit.cjs [URL]`
- `tests/render-review.cjs` – finální rendery pro kritiku designu do `tests/shots/review/` (desktop 1280×800, iPhone 13, tmavý režim mobilu): `node tests/render-review.cjs [URL]`
- `manifest.webmanifest`, `icons/` – aplikace na plochu. Ikony (lev na dřevěném kameni s indigovým okrajem) se generují z kresby lva:
  `node tools/make-icons.cjs` (Playwright vyrenderuje `icons/icon.svg` do PNG 192, 512 a 180 pro `apple-touch-icon`).

## Hra na plochu a celá obrazovka

- Tlačítko s ikonou rohů v hlavičce: kde je Fullscreen API (Chrome, Edge, Firefox, iPad), přepíná celou obrazovku a popisek se mění
  („Celá obrazovka“ / „Ukončit celou obrazovku“). Na iPhonu (a kde API chybí) otevře nápovědu „Přidat na plochu“:
  v Safari Sdílet → Přidat na plochu, hra se pak otevírá přes celou obrazovku.
- Když hra už běží jako aplikace z plochy (`display-mode: standalone` nebo `navigator.standalone`), tlačítko zmizí.
- Manifest záměrně nemá `start_url`: výchozí je adresa stránky, na které se hra přidala. Proto si hru přidej na plochu z otevřeného
  odkazu své hry (`…/#r.<id>`), ikona pak otevře rozehranou partii.
- iOS dává aplikaci z plochy oddělené úložiště. Když se otevře bez `#r.` a nemá žádné rozehrané hry, úvodní obrazovka nabídne pole
  „Vlož odkaz na hru“ (přijme celý odkaz i jen `#r.<id>`). Hráč pak pokračuje tlačítkem „Jsem …“ (platí i u skončené partie).

## Rozvržení a tmavý režim

- Mobil na výšku: hlavička, obě zásoby a celá deska se vejdou bez posouvání (velikost desky určuje `--bw` z výšky okna), stav je pod nimi.
- Desktop ≥ 980 px: deska s oběma zásobami vlevo (větší než na mobilu), stav partie a pravidla v pravém sloupci.
- Tmavý režim přebarvuje jen papír a text. Deska, tatami, dřevěné zásoby a kameny zůstávají „fyzické“. Texty v barvách hráčů
  používají světlejší tokeny `--ai-t` / `--kaki-t` (kontrast ≥ 4,5:1, hlídá ho test).

## Varianty kola, odveta a série

- Každé kolo má jedno z 5 výchozích rozestavení, všechna souměrná podle středu desky (pro oba stejná):
  **Klasika**; **Dárek** (oba mají kuřátko navíc v zásobě); **Prohozená křídla** (žirafa a slon si vymění strany);
  **Bez kuřátek** (kuřátko jen v zásobě); **Slepičí start** (kuřátka začínají jako slepice).
- První kolo místnosti je vždy Klasika. Pro další kolo engine nabídne 2 varianty deterministicky ze seedu (id místnosti + číslo kola,
  `Sogi.offer`), nikdy tu, která se právě hrála. Oba hráči tak vidí totéž bez dalšího zápisu.
- Po výhře zakládá odvetu poražený: vybere jednu ze dvou variant a začíná. Vítěz tlačítko odvety nemá a vidí, z čeho soupeř vybírá
  (hra stejně nemůže pokračovat, dokud poražený netáhne, takže se nic nezasekne). Po remíze může odvetu založit kdokoli, platí první nabídnutá.
- Férovost: test pro každou variantu a oba začínající ověřuje, že nikdo nevyhraje prvním tahem a začínající nevynutí výhru do 9 půltahů
  a má bezpečný první tah. Jednorázově ověřeno i do 11 půltahů (6 tahů začínajícího).
- Dokument partie nese `vr` (varianta) a `n` (číslo kola, roste i po remíze). Starý dokument bez `vr` se hraje jako Klasika.
- Tituly podle výher v sérii: 1 Učeň, 3 Strážce zásoby, 5 Lví mistr. Ukazují se u jména hráče a v lístku výsledku; nově dosažený titul
  se v konci partie jednou krátce zvýrazní. Od 3 výher má kotouč hráče tenký lakovaný okraj a razítko jeho výhry je hranaté.

## Pravidla a zdroj

Ověřeno 2026-10-30 z jednoho zdroje: anglická Wikipedie, heslo „Dōbutsu shōgi“ (stav k 30. 10. 2026).

- Deska 3 × 4. Každý má lva uprostřed domácí řady, žirafu vpravo, slona vlevo a kuřátko před lvem.
- Každá figurka jde o 1 pole: lev kamkoli, žirafa rovně, slon šikmo, kuřátko dopředu.
- Kuřátko na poslední řadě se promění ve slepici (jako zlatý generál: kamkoli kromě šikmo dozadu).
- Sebrané zvíře přechází k tomu, kdo ho sebral, a ten ho místo tahu může položit na kterékoli volné pole. Slepice se vrací
  jako kuřátko. Omezení klasického šógi pro pokládání neplatí. Kuřátko položené na poslední řadu se nepromění a nehne se.
- Výhra: chycení soupeřova lva, nebo vstup vlastního lva na soupeřovu poslední řadu, pokud tam není hned v ohrožení.
- Stejná pozice potřetí = remíza (zdroj: „the same position three turns in a row“; počítá se pozice desky, zásob a kdo táhne).
- Kdo začíná, zdroj neuvádí: volí zakladatel hry, v odvetě začíná poražený (po remíze ten, kdo minule nezačínal).
- Doplněk hry, ne pravidlo zdroje: hráč bez jediného tahu prohrává (prakticky nenastane), lze se vzdát.
