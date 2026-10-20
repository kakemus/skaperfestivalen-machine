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
  `node tests/kvittering.test.mjs` spiller alle 55 veier gjennom spillet og sjekker at den nye
  motoren gir nøyaktig samme kvittering som originalen i `kvitteringsspillet.html`.
- **Ikke gjort ennå:** spillet er ikke koblet til maskinen. `phone.js` kjører fortsatt «Livet AS».
  Det som gjenstår: `game/kvittering.js` med samme form som `createLifeGame(io)`, kvitteringene
  tegnet for skriveren, og beltet med ett spørsmål per skjerm.
- **10 spørsmål = 10 skjermer** på beltet (`SET:screens:10`, som telefonen allerede sender).
- **Bredden** er 32 tegn per linje (`BREDDE` i motoren). `game/receipt.js` tegner på 576 punkter
  (80 mm), så tekststørrelsen der avgjør hvor mange tegn som får plass.
- **Feiltestingsvinduet** kan bli nyttig i operatørpanelet på telefonen.

Ingen hast: dette kan godt vente til etter festivalen.
