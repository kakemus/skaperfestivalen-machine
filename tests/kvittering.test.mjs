// Test for Kvitteringsspillet. Kjør med:  node tests/kvittering.test.mjs
// Ingen avhengigheter. Sjekker at
//   1. game/manus.js er manuset fra kvitteringsspillet/kvitteringsspillet.html, med bare den
//      ene endringen vi har gjort (spørsmål 10 «Nei»),
//   2. game/kvitteringMotor.js gir nøyaktig de samme kvitteringene som den originale motoren
//      i HTML-fila, for ALLE veier gjennom spillet,
//   3. manuset passer maskinen: høyst to svar per spørsmål (JA / NEI), bare kjente steg,
//      ingen linje bredere enn kvitteringen, og minst én vei til seier,
//   4. game/kvittering.js (klokka, alderen, pausen etter slutt) med en falsk klokke og en
//      falsk maskin — til slutt en hel festivaldag med tilfeldige trykk.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { MANUS } from "../game/manus.js";
import * as ny from "../game/kvitteringMotor.js";
import { createKvitteringGame, LIVSTID_MS, LEVEALDER, PAUSE_ETTER_SLUTT_MS, LINJE_MS } from "../game/kvittering.js";

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

async function sjekkAsync(navn, fn) {
  try { await fn(); console.log("  ok   " + navn); }
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
const gamleVeier = alleVeier(gammeltManus);

console.log("Manus");
sjekk("game/manus.js = manuset i HTML-fila + svaret på spørsmål 10 «Nei»", () => {
  const forventet = structuredClone(gammeltManus);
  assert.deepEqual(forventet.sporsmal[9].svar.Nei, []);
  forventet.sporsmal[9].svar.Nei = [{ no: "Vil du ha kvitteringen?" }];
  assert.deepEqual(MANUS, forventet);
});
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
  for (const vei of gamleVeier) {
    const a = spillVei(gammel, gammeltManus, vei), b = spillVei(ny, gammeltManus, vei);
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
  const før = structuredClone(MANUS);
  for (const vei of veier) spillVei(ny, MANUS, vei);
  assert.deepEqual(MANUS, før);
});
sjekk("svarlinja har alderen til høyre og er 32 tegn", () => {
  assert.equal(ny.svarLinje(3, "Ja", 23), "3. Ja -------------------- 23 år");
  assert.equal(ny.svarLinje(2, "Venner", 0).length, ny.BREDDE);
  assert.equal(ny.svarLinje(10, "Nei", 67).length, ny.BREDDE);
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

// ---------- spillet: klokke og maskin er falske, tiden er virtuell ----------
const tom = () => new Promise(r => setImmediate(r));   // lar alle ventende promises gå ferdig

function lagMaskin({ skriverHenger = false } = {}) {
  let t = 0, nesteId = 0;
  const timere = new Map();
  const m = {
    now: () => t,
    after(ms, fn) { timere.set(++nesteId, { at: t + ms, fn }); return nesteId; },
    cancel(id) { timere.delete(id); },
    /** Lar `ms` virtuelle millisekunder gå, og kjører timerne i riktig rekkefølge. */
    async gå(ms) {
      const slutt = t + ms;
      for (;;) {
        await tom();
        let neste = null;
        for (const [id, e] of timere) if (e.at <= slutt && (!neste || e.at < neste[1].at)) neste = [id, e];
        if (!neste) break;
        timere.delete(neste[0]);
        t = neste[1].at;
        neste[1].fn();
      }
      t = slutt;
      await tom();
    },
    utskrift: [], kutt: 0, steg: 0, spoling: 0, tilstander: [], logg: [],
    tider: [],
    print(label, lines) {
      m.utskrift.push(...lines);
      for (const l of lines) m.tider.push({ l, t });
      return skriverHenger ? new Promise(() => {}) : new Promise(r => m.after(40 + lines.length * 10, r));
    },
    cut() { m.kutt++; m.utskrift.push("✂"); return new Promise(r => m.after(200, r)); },
    belt: {
      step() { m.steg++; return new Promise(r => m.after(1600, r)); },
      rewind() { m.spoling++; return new Promise(r => m.after(3000, r)); },
    },
    bell() {}, flash() {}, hurry() {}, celebrate() {},
    log: s => m.logg.push(s),
    tilstandTider: [],
    onState: s => { m.tilstander.push(s.state); m.tilstandTider.push({ state: s.state, t }); },
  };
  return m;
}

/** Lar tiden gå til et spørsmål venter på svar ("deciding"), eller maskinen står klar ("ready"). */
async function tilSvar(m, spill, maks = 120000) {
  for (let i = 0; i < maks / 5 && spill.state !== "deciding" && spill.state !== "ready"; i++) await m.gå(5);
}
/** Slår på maskinen: beltet til START, så står spørsmål 1 klart. */
async function klar(m, spill) {
  spill.start();
  await tilSvar(m, spill);
  assert.equal(spill.state, "ready");
}
/** Når en tilstand først ble nådd etter tidspunktet `fra`. */
const førsteGang = (m, tilstand, fra = 0) => m.tilstandTider.find(x => x.state === tilstand && x.t >= fra)?.t;

console.log("Spillet (falsk klokke og maskin)");
await sjekkAsync("maskinen står klar på spørsmål 1: ingen utskrift og ingen klokke før noen svarer", async () => {
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  await m.gå(3600 * 1000);                   // en time uten spillere
  assert.equal(spill.state, "ready");
  assert.equal(m.utskrift.length, 0);
  assert.equal(spill.igjenMs, LIVSTID_MS);
});
await sjekkAsync("et spill med JA på alt: første svar starter, alder ved hvert svar, slutt, kutt, pause, spoling, klar igjen", async () => {
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  await m.gå(5000);                          // tiden før første svar teller ikke
  spill.answer(true);
  assert.equal(spill.state, "answering");
  await tilSvar(m, spill);
  while (spill.state === "deciding") {
    await m.gå(2000);                        // 2 sekunder å bestemme seg = 2,2 år
    spill.answer(true);
    await tilSvar(m, spill);
  }
  assert.deepEqual(m.utskrift.slice(0, 2), ["KVITTERINGSSPILLET", "=".repeat(ny.BREDDE)]);
  const svar = m.utskrift.filter(l => /^\d+\. /.test(l));
  assert.ok(svar.length >= 3, "for få svar: " + svar.length);
  svar.forEach((l, i) => assert.ok(l.endsWith(` ${Math.floor(i * 2000 * LEVEALDER / LIVSTID_MS)} år`), l));
  assert.equal(m.kutt, 1);
  assert.equal(spill.state, "ready");
  assert.equal(spill.nr, 0);
  assert.ok(m.now() > 30000, "spillet var for kort til å teste skrivervakten");
  assert.ok(!m.logg.includes("Skriveren svarer ikke"), "en skriver som virker ble meldt som hengt");
});
await sjekkAsync("klokka står stille mens maskinen skriver og flytter beltet", async () => {
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  spill.answer(true);
  await tilSvar(m, spill);
  await m.gå(6000); spill.answer(true);     // 6 s = 6 år
  const svart = m.now();
  await m.gå(10);
  assert.equal(spill.state, "answering");
  while (spill.state !== "deciding") await m.gå(10);   // maskinen skriver og flytter beltet …
  assert.ok(m.now() - svart >= 1600, "maskinen brukte ingen tid?");
  assert.equal(spill.alder, 6);                          // … men livet gikk ikke imens
  assert.equal(spill.igjenMs, LIVSTID_MS - 6000);
});
await sjekkAsync("kvitteringen skrives linje for linje, LINJE_MS per tekstlinje, og livet står stille imens", async () => {
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  spill.answer(true);
  await tilSvar(m, spill);
  await m.gå(3000); spill.answer(true);
  const fra = m.tider.length;
  await m.gå(10);
  while (spill.state !== "deciding") {
    assert.equal(spill.alder, 3, "alderen endret seg mens kvitteringen ble skrevet");
    await m.gå(100);
  }
  const linjer = m.tider.slice(fra);
  assert.ok(linjer.length >= 5, "for få linjer");
  for (let i = 1; i < linjer.length; i++) {
    const ms = linjer[i].t - linjer[i - 1].t, forrige = linjer[i - 1].l;
    assert.equal(ms, forrige ? LINJE_MS : LINJE_MS / 4, `"${forrige}" fikk ${ms} ms`);
  }
  assert.ok(LIVSTID_MS - 3000 - spill.igjenMs < 100, `${spill.igjenMs} ms igjen`);   // < 100 ms inn i neste spørsmål
});
await sjekkAsync("ingen svar etter det første: etter 60 s er tiden ute, «Du ble 67 år», kutt, klar igjen", async () => {
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  spill.answer(true);
  await tilSvar(m, spill);
  await m.gå(LIVSTID_MS - 100);
  assert.equal(spill.state, "deciding");
  await m.gå(200);
  assert.equal(spill.state, "over");
  await m.gå(20000);                         // sluttkvitteringen skrives, linje for linje
  assert.ok(m.utskrift.includes("Tiden er ute. Du ble 67 år."), m.utskrift.slice(-8).join("\n"));
  assert.equal(m.kutt, 1);
  await tilSvar(m, spill);
  assert.equal(spill.state, "ready");
});
await sjekkAsync("etter slutt: 5 s pause der trykk ignoreres, så spoles beltet tilbake, så er spørsmål 1 klart", async () => {
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  spill.answer(true);
  await tilSvar(m, spill);
  await m.gå(LIVSTID_MS + 100);              // tiden går ut
  while (spill.state === "over") await m.gå(10);
  const pauseStart = m.now(), spolingFør = m.spoling, utskrevet = m.utskrift.length;
  assert.equal(spill.state, "pause");
  while (spill.state !== "ready") {
    const før = spill.state;
    spill.answer(true); spill.answer(false); spill.start();
    assert.equal(spill.state, før, "et trykk ble ikke ignorert");
    await m.gå(10);
  }
  const spolingStart = førsteGang(m, "rewinding", pauseStart);
  assert.ok(spolingStart - pauseStart >= PAUSE_ETTER_SLUTT_MS, `beltet spolte etter bare ${spolingStart - pauseStart} ms`);
  assert.equal(m.spoling, spolingFør + 1);
  assert.equal(m.utskrift.length, utskrevet, "noe ble skrevet ut i pausen");
  assert.equal(m.kutt, 1);
});
await sjekkAsync("spørsmål 10 «Nei» skriver «Vil du ha kvitteringen?» og er en seier", async () => {
  const vei = ny.vinnerveier(MANUS, ny.nyttSpill(), 0).find(v => v[9] === "Nei");
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  for (const v of vei) {
    spill.answer(v === Object.keys(MANUS.sporsmal[spill.nr].svar)[0]);
    await tilSvar(m, spill);
    await m.gå(1000);
  }
  assert.ok(m.utskrift.includes("Vil du ha kvitteringen?"));
  assert.ok(m.utskrift.includes("DU KLARTE DET!"));
});
await sjekkAsync("en skriver som henger stopper ikke spillet, og venter bare én gang på den", async () => {
  const m = lagMaskin({ skriverHenger: true }), spill = createKvitteringGame(m);
  await klar(m, spill);
  spill.answer(true);
  await m.gå(35000);                         // 20 s venting på skriveren, så videre i lesetempo
  assert.equal(spill.state, "deciding");
  const fra = m.now();
  spill.answer(true);
  await tilSvar(m, spill);
  assert.equal(spill.state, "deciding");
  assert.ok(m.now() - fra < 30000, `svaret tok ${m.now() - fra} ms med en skriver som henger`);
  assert.equal(m.logg.filter(l => l === "Skriveren svarer ikke").length, 1);
});
await sjekkAsync("en hel festivaldag (10 timer) med tilfeldige trykk: hvert spill ender, kuttes én gang og blir klart igjen", async () => {
  let frø = 42;
  const tilfeldig = () => (frø = (frø * 1103515245 + 12345) % 2147483648) / 2147483648;
  const m = lagMaskin(), spill = createKvitteringGame(m);
  await klar(m, spill);
  let spillTotalt = 0, lengst = 0, startTid = 0;
  while (m.now() < 10 * 3600 * 1000) {
    const r = tilfeldig(), varKlar = spill.state === "ready";
    if (r < 0.48) spill.answer(true);
    else if (r < 0.96) spill.answer(false);
    else if (r < 0.961) spill.reset();
    if (varKlar && spill.state === "answering") { spillTotalt++; startTid = m.now(); }
    await m.gå(Math.floor(tilfeldig() * 4000));
    if (spill.state !== "ready") lengst = Math.max(lengst, m.now() - startTid);
    assert.ok(m.now() - startTid < 10 * 60 * 1000 || spill.state === "ready", `et spill har vart ${m.now() - startTid} ms (${spill.state})`);
  }
  assert.ok(spillTotalt > 100, "bare " + spillTotalt + " spill");
  assert.ok(!m.logg.includes("Skriveren svarer ikke"), "en skriver som virker ble meldt som hengt");
  assert.ok(m.kutt <= spillTotalt && m.kutt >= spillTotalt * 0.9, `${m.kutt} kutt for ${spillTotalt} spill`);
  console.log(`       ${spillTotalt} spill, ${m.kutt} kutt, lengste spill ${Math.round(lengst / 1000)} s`);
});

console.log(feil ? `\n${feil} sjekk(er) feilet.` : "\nAlt ok.");
process.exit(feil ? 1 : 0);
