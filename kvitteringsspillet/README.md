# Kvitteringsspillet — Aksels manus

Et ferdig skrevet spill for maskinen: 10 valg gjennom et helt liv, der alt du kjøper, tjener og
mister skrives ut på kvitteringen. Du taper hvis du går i minus på kroner, går tom for venner
eller dør. Skrevet i en egen økt, og lagt her uten å røre resten av prosjektet.

## Prøv det

Åpne `kvitteringsspillet.html` i en nettleser. Fila er selvstendig og trenger hverken server eller
maskinvare. Svar med knappene eller med forbokstaven på tastaturet. Tast **D** åpner og lukker
feiltestingsvinduet, som viser venner, kroner og hvilke svar som fortsatt kan gi seier.

## Hva som ligger her

- `kvitteringsspillet.html` — den ferdige spillsiden. Den er *generert*: kildene er `manus.json`
  (historien), `motor.js` (reglene), `mal.html` og `lag-html.js`, pluss mappa `bilder/`. De legges
  til i denne grenen senere. Denne kopien har ikke bildene inne, så den viser `[ Labubu ]` osv.

## Manuset

Hvert spørsmål har en liste med svar, og hvert svar er en rekke steg som utføres i rekkefølge:

| Steg | Betyr |
|---|---|
| `{ "no": "..." }` | Tekst som skrives ut |
| `{ "kroner": -800, "post": "Labubu" }` | Kroner inn eller ut, med en linje på kvitteringen |
| `{ "venner": ["Emma", "Noah"] }` | Nye venner legges øverst i stabelen |
| `{ "venner": 4567, "navn": "..." }` | Mange venner med samme navn |
| `{ "venner": -3 }` | De 3 nyeste vennene forsvinner |
| `{ "visning": "venner" }` | Kvitteringen viser bare venner (eller kroner) fra nå |
| `{ "sum": "venner" }` | Skriver totalen |
| `{ "slutt": "død" }` | Spilleren dør |

Saldoen sjekkes etter hvert steg. Kroner under 0, eller flere venner fjernet enn det finnes, betyr
tap.

## Slik kan det passe inn i maskinen

- **Ligner «Livet AS».** `game/life.js` / `game/cards.js` / `game/receipt.js` er samme idé (kjøp
  eller avslå, alt havner på kvitteringen). Dette spillet har mer logikk (venner og kroner, tekster
  underveis, død), så det passer best som en egen spillmodul ved siden av, f.eks.
  `game/kvittering.js`, som snakker med maskinen gjennom det samme `io`-objektet.
- **Maskinen har bare JA og NEI.** Spørsmål 2 har valgene «Venner / Penger», og spørsmål 10 har et
  tomt «Nei». Det må bestemmes hvilken knapp som er hva.
- **Gjort: motoren og manuset er ES-moduler.** `game/kvitteringMotor.js` (reglene) og
  `game/manus.js` (historien), og begge er med i offline-kopien (`sw.js`, `phone_server.py`).
- **Gjort: spillet på maskinen, `game/kvittering.js`** (samme form som `createLifeGame(io)`):
  - **Spørsmål 1 står klart** så snart maskinen er ledig. Det første svaret starter spillet
    (overskrift + svar skrives ut), og klokka går fra da av. Ingenting skrives ut før noen svarer.
  - Et liv er **4 minutter = 67 år** (var 60 sekunder, ca. 6 s per spørsmål var for kort; så prøvd 10 og 3 minutter). Klokka går bare mens spilleren velger, ikke mens maskinen
    skriver ut eller flytter beltet.
  - Kvitteringen skrives **linje for linje, et halvt sekund per linje** (tomme linjer en firedel
    av det), så spillerne kan lese mens den kommer ut. Imens viser beltet neste spørsmål.
    `LINJE_MS` i `game/kvittering.js`. Simulatoren lager en «skhsh»-lyd for hver linje.
  - Henger skriveren, venter spillet på den én gang (20 s) og fortsetter så i lesetempo.
  - Hvert svar skrives med alderen: `3. Ja -------------------- 23 år`.
  - **Saldoen sjekkes når hele svaret er utført**, ikke etter hvert steg som i prototypen, så
    historien i et svar alltid kommer ut før «SPILLET ER TAPT». Kroner under 0 når svaret er
    ferdig er tap; venner som skulle forsvinne men ikke fantes, dekkes av nye venner senere i
    samme svar, ellers er det tap. Døden stopper svaret med en gang. Panten på seilbåten
    (spørsmål 8 «Ja») er satt ned fra 9500 til 50 kr, så den ikke redder noen.
  - Er de 4 minuttene brukt opp, er spillet over: «Tiden er ute. Du ble 67 år.»
  - **JA = første svar, NEI = andre** (spørsmål 2: JA = Venner, NEI = Penger).
  - Spørsmål 10 «Nei» skriver «Vil du ha kvitteringen?» og er en seier.
  - Etter slutt: kvitteringen kuttes, spilleren får **5 sekunder** (trykk ignoreres), **så**
    spoles beltet tilbake, og spørsmål 1 står klart for neste spiller.
  - Alle ventinger på skriver og belte har en tidsgrense, så en skriver som henger stopper ikke
    spillet.
- **Simulator:** `simulator.html` (dobbeltklikk `start-simulator.command`) kjører det samme spillet
  i nettleseren uten maskinvare: vinduet, knappene, lyset, bjella og skriveren. Tiden vises bare
  på kvitteringen. Tast **D** åpner feiltesting: kroner, venner, alder, tid og riktige svar.
- **Tester:** `node tests/kvittering.test.mjs` spiller alle 55 veier og sjekker at motoren gir
  samme kvittering som originalen, og kjører spillet med en falsk klokke: alder, livstiden, pausen,
  spørsmål 10, en skriver som henger, og en hel festivaldag (10 timer) med tilfeldige trykk.
- **Ikke gjort ennå:** `phone.js` kjører fortsatt «Livet AS». Det som gjenstår: kvitteringslinjene
  tegnet for skriveren, beltet med ett spørsmål per skjerm, og byttet i `phone.js`.
- **10 spørsmål = 10 skjermer** på beltet (`SET:screens:10`, som telefonen allerede sender).
- **Bredden** er 32 tegn per linje (`BREDDE` i motoren). `game/receipt.js` tegner på 576 punkter
  (80 mm), så tekststørrelsen der avgjør hvor mange tegn som får plass.
- **Feiltestingsvinduet** kan bli nyttig i operatørpanelet på telefonen.

Ingen hast: dette kan godt vente til etter festivalen.
