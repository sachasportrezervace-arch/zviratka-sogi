# Zvířátkové šógi

Živá hra pro dva na jednom odkazu: https://sachasportrezervace-arch.github.io/zviratka-sogi/

Malá japonská hra na desce 3 × 4 (lev, žirafa, slon, kuřátko). Vlastní název, vlastní kresby zvířátek (SVG v `index.html`).
Architektura a synchronizace převzaté z Psaníčka: statická stránka na GitHub Pages, stav partie v JSON dokumentu na
`mantledb.sh` (bez účtu), odkaz `#r.<id>`, dotazování každé 2,5 s, zápis s kontrolou počítadla `v`.

## Soubory

- `index.html` – celá hra (vzhled, kresby, místnost, animace).
- `engine.js` – pravidla: tahy, sebrání, položení, proměna, výhra, opakování pozice.
- `tests/engine.test.cjs` – 10 testů pravidel: `node tests/engine.test.cjs`
- `tests/dva-prohlizece.cjs` – celá série ve 2 prohlížečích (Chromium jako Pixel 7, WebKit jako iPhone 13) + přihlížející:
  `node tests/dva-prohlizece.cjs https://sachasportrezervace-arch.github.io/zviratka-sogi/`

## Pravidla a zdroj

Ověřeno 2026-10-30 z jednoho zdroje: anglická Wikipedie, heslo „Dōbutsu shōgi“ (stav k 30. 10. 2026).

- Deska 3 × 4. Každý má lva uprostřed domácí řady, žirafu vpravo, slona vlevo a kuřátko před lvem.
- Každá figurka jde o 1 pole: lev kamkoli, žirafa rovně, slon šikmo, kuřátko dopředu.
- Kuřátko na poslední řadě se promění ve slepici (jako zlatý generál: kamkoli kromě šikmo dozadu).
- Sebrané zvíře přechází k tomu, kdo ho sebral, a ten ho místo tahu může položit na kterékoli volné pole. Slepice se vrací
  jako kuřátko. Omezení klasického šógi pro pokládání neplatí. Kuřátko položené na poslední řadu se nepromění a nehne se.
- Výhra: chycení soupeřova lva, nebo vstup vlastního lva na soupeřovu poslední řadu, pokud tam není hned v ohrožení.
- Stejná pozice potřetí = remíza (zdroj: „the same position three turns in a row“; počítá se pozice desky, zásob a kdo táhne).
- Kdo začíná, zdroj neuvádí: volí zakladatel hry, v odvetě začíná poražený.
- Doplněk hry, ne pravidlo zdroje: hráč bez jediného tahu prohrává (prakticky nenastane), lze se vzdát.
