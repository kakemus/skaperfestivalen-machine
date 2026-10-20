// Test for Kvitteringsspillet. Kjør med:  node tests/kvittering.test.mjs
// Ingen avhengigheter. Sjekker at
//   1. game/manus.js er det samme manuset som i kvitteringsspillet/kvitteringsspillet.html,
//   2. game/kvitteringMotor.js gir nøyaktig de samme kvitteringene som den originale motoren
//      i HTML-fila, for ALLE veier gjennom spillet,
//   3. manuset passer maskinen: høyst to svar per spørsmål (JA / NEI), bare kjente steg,
//      ingen linje bredere enn kvitteringen, og minst én vei til seier.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { MANUS } from "../game/manus.js";
import * as ny from "../game/kvitteringMotor.js";

const rot = fileURLToPath(new URL("..", import.meta.url));
const html = readFileSync(rot + "kvitteringsspillet/kvitteringsspillet.html", "utf8");

// Den originale motoren er det første <script>-et i HTML-fila, skrevet for Node (module.exports).
const skript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const sandkasse = { module: { exports: {} } };
vm.runInNewContext(skript[0], sandkasse);
const gammel = sandkasse.module.exports;
const gammeltManus = JSON.parse(skript[1].match(/const MANUS = (\{.*\});\n/)[1]);

let feil = 0;
function sjekk(navn, fn) {
  try { fn(); console.log("  ok   " + navn); }
  catch (e) { feil++; console.log("  FEIL " + navn + "\n       " + e.message.split("\n").join("\n       ")); }
}

// Spiller én vei (en liste med valg) slik siden gjør: svarene i rekkefølge, slutten når
// spilleren taper eller spørsmålene er brukt opp. Gir hele kvitteringen og hvordan det endte.
function spillVei(motor, manus, vei) {
  const spill = motor.nyttSpill();
  const linjer = [];
  let i = 0;
  for (; i < vei.length; i++) {
    linjer.push(`${manus.sporsmal[i].nr}. ${vei[i]}`, ...motor.spillSvar(spill, manus.sporsmal[i], vei[i]));
    if (spill.tapt) break;
  }
  linjer.push(...motor.sluttLinjer(spill, manus.avslutning));
  return { linjer, tapt: spill.tapt, grunn: spill.grunn, kom: i + 1 };
}

// Alle veier: ved hvert spørsmål prøves hvert svar, til spilleren taper eller kommer til slutten.
function alleVeier(manus) {
  const veier = [];
  (function prov(i, spill, vei) {
    if (i === manus.sporsmal.length) { veier.push(vei); return; }
    for (const v of Object.keys(manus.sporsmal[i].svar)) {
      const s = ny.kopi(spill);
      ny.spillSvar(s, manus.sporsmal[i], v);
      if (s.tapt) veier.push([...vei, v]); else prov(i + 1, s, [...vei, v]);
    }
  })(0, ny.nyttSpill(), []);
  return veier;
}

const veier = alleVeier(MANUS);

console.log("Manus");
sjekk("game/manus.js er likt manuset i HTML-fila", () => assert.deepEqual(MANUS, gammeltManus));
sjekk("høyst to svar per spørsmål (maskinen har bare JA og NEI)", () => {
  for (const s of MANUS.sporsmal) {
    const n = Object.keys(s.svar).length;
    assert.ok(n >= 1 && n <= 2, `spørsmål ${s.nr} har ${n} svar`);
  }
});
sjekk("bare steg motoren kjenner", () => {
  const kjent = s => "visning" in s || "no" in s || ("kroner" in s && "post" in s) || "venner" in s
    || s.sum === "venner" || s.sum === "kroner" || s.slutt === "død";
  for (const s of MANUS.sporsmal) for (const [valg, steg] of Object.entries(s.svar))
    for (const st of steg) assert.ok(kjent(st), `spørsmål ${s.nr} "${valg}": ukjent steg ${JSON.stringify(st)}`);
});

console.log(`Motoren (${veier.length} veier gjennom spillet)`);
sjekk("ny motor gir samme kvittering som den originale, på alle veier", () => {
  for (const vei of veier) {
    const a = spillVei(gammel, gammeltManus, vei), b = spillVei(ny, MANUS, vei);
    assert.deepEqual(b, a, `forskjell på veien ${vei.join(" → ")}`);
  }
});
sjekk(`ingen linje er bredere enn ${ny.BREDDE} tegn`, () => {
  for (const vei of veier) for (const l of spillVei(ny, MANUS, vei).linjer)
    if (!/^\d+\. /.test(l)) assert.ok(l.length <= ny.BREDDE, `${l.length} tegn: "${l}" (veien ${vei.join(" → ")})`);
});
sjekk("vinnerveier() finner de samme seirene som en full gjennomgang", () => {
  const seire = veier.filter(v => !spillVei(ny, MANUS, v).tapt && v.length === MANUS.sporsmal.length);
  assert.deepEqual(ny.vinnerveier(MANUS, ny.nyttSpill(), 0).map(String).sort(), seire.map(String).sort());
  assert.ok(seire.length > 0, "ingen vei fører til seier");
});
sjekk("motoren endrer ikke manuset", () => {
  assert.deepEqual(MANUS, gammeltManus);
});

// Oversikt, nyttig når manuset endres
const utfall = {};
for (const v of veier) {
  const r = spillVei(ny, MANUS, v);
  const k = r.tapt ? `tapt (${r.grunn}) på spørsmål ${r.kom}` : "vunnet";
  utfall[k] = (utfall[k] || 0) + 1;
}
console.log("Utfall");
for (const [k, n] of Object.entries(utfall).sort()) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log(feil ? `\n${feil} sjekk(er) feilet.` : "\nAlt ok.");
process.exit(feil ? 1 : 0);
