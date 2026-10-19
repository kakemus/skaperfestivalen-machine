# v2 — håndholdt kvitteringsleser

Videreføring av maskinen etter Skaperfestivalen: en håndholdt måte å skrolle gjennom
kvitteringer og lese dem, for installasjoner og en analog leseopplevelse.

## Slik jobber vi

- Originalen i rotmappa står urørt, så den kan brukes til sammenligning.
- Koden bygges opp på nytt her i `v2/`, én fil eller funksjon om gangen. Hver del gjennomgås,
  renskrives og committes for seg.
- Samme regler som originalen: ingen byggesteg, ingen avhengigheter, rene ES-moduler i Chrome.

## Rekkefølge

1. `core/eventBus.js`, `core/clock.js`: små byggeklosser
2. `game/`: logikk som ikke trenger maskinvare
3. `tickets/`, `game/receipt.js`, `belt/strip.js`: tegning og kvitteringer
4. `core/printer.js`, `core/raster.js`, `core/controller.js`: maskinvare
5. Siden som binder alt sammen
6. `firmware/` (Python på micro:bit-en) til slutt

## Gjennomgått

_(ingenting ennå)_
