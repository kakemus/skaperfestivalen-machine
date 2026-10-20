// Spillmotoren for Kvitteringsspillet (Aksels manus, game/manus.js): utfører stegene
// i et svar og gir tilbake linjene som skal på kvitteringen. Ren logikk — vet ingenting
// om siden, skriveren eller beltet, så den kan testes alene (tests/kvittering.test.mjs).
// Flyttet fra motor.js i kvitteringsspillet/kvitteringsspillet.html. Én regel er endret
// (Aksel, 2026-10-20): saldoen sjekkes når hele svaret er utført, ikke etter hvert steg,
// så historien i et svar alltid kommer ut før «SPILLET ER TAPT».

export const BREDDE = 32; // tegn per linje på kvitteringen

export function nyttSpill() {
  return {
    venner: [],        // stabel: nyeste venn ligger sist i lista
    kroner: 0,
    tapt: false,
    grunn: null,       // "kroner", "venner", "død" eller "tid" når spillet er tapt
    alder: 0,          // hvor gammel spilleren ble, når tiden gikk ut
    vennegjeld: 0,     // venner som skulle forsvinne, men som ikke fantes (innenfor ett svar)
    visning: null,     // "venner" eller "kroner", settes av svaret på spørsmål 2. Før det vises begge.
    sumSkrevet: false, // et "sum"-steg har skrevet totalen, så sluttLinjer hopper over sin
  };
}

/** En selvstendig kopi, så man kan prøve et svar uten å endre det ekte spillet. */
export const kopi = spill => ({ ...spill, venner: [...spill.venner] });

// Én linje med tekst til venstre og tall til høyre, f.eks. "Labubu            -800"
function kolonner(venstre, hoyre) {
  const plass = BREDDE - hoyre.length - 1;
  const v = venstre.length > plass ? venstre.slice(0, plass) : venstre;
  return v + " ".repeat(BREDDE - v.length - hoyre.length) + hoyre;
}

/** Bryter lang tekst over flere linjer på hele ord. */
export function brytTekst(tekst) {
  const linjer = [];
  let linje = "";
  for (const ord of tekst.split(" ")) {
    if (linje && (linje + " " + ord).length > BREDDE) {
      linjer.push(linje);
      linje = ord;
    } else {
      linje = linje ? linje + " " + ord : ord;
    }
  }
  if (linje) linjer.push(linje);
  return linjer;
}

// Én linje per venn ("Emma 1x"). Like navn etter hverandre slås sammen ("Ikke navngitt venn 4567x").
function vennelinjer(navneliste, fortegn) {
  const ut = [];
  let i = 0;
  while (i < navneliste.length) {
    let j = i;
    while (j < navneliste.length && navneliste[j] === navneliste[i]) j++;
    ut.push(kolonner(navneliste[i], fortegn + (j - i) + "x"));
    i = j;
  }
  return ut;
}

// Skal denne typen linjer (venner eller kroner) skrives ut på kvitteringen?
const vises = (spill, type) => !spill.visning || spill.visning === type;

// Utfører ett steg. Returnerer linjene som skal skrives ut.
function utforSteg(spill, steg) {
  const ut = [];

  if ("visning" in steg) {
    spill.visning = steg.visning;
  } else if ("no" in steg) {
    ut.push("", ...brytTekst(steg.no));
  } else if ("kroner" in steg) {
    spill.kroner += steg.kroner;
    if (vises(spill, "kroner")) {
      const fortegn = steg.kroner > 0 ? "+" : "";
      ut.push(kolonner(steg.post, fortegn + steg.kroner + " kr"));
    }
  } else if (Array.isArray(steg.venner)) {
    spill.venner.push(...steg.venner);
    if (vises(spill, "venner")) ut.push(...vennelinjer(steg.venner, ""));
    betalVennegjeld(spill);
  } else if (typeof steg.venner === "number" && steg.venner > 0) {
    // Mange venner uten egne navn, f.eks. { "venner": 4567, "navn": "Ikke navngitt venn" }
    const nye = Array(steg.venner).fill(steg.navn);
    spill.venner.push(...nye);
    if (vises(spill, "venner")) ut.push(...vennelinjer(nye, ""));
    betalVennegjeld(spill);
  } else if (typeof steg.venner === "number") {
    const borte = [];
    for (let i = 0; i < -steg.venner; i++) {
      if (spill.venner.length === 0) spill.vennegjeld++;   // finnes ikke: sjekkes når svaret er ferdig
      else borte.push(spill.venner.pop());
    }
    if (vises(spill, "venner")) ut.push(...vennelinjer(borte, "-"));
  } else if (steg.sum === "venner") {
    spill.sumSkrevet = true;
    ut.push(kolonner("Total venner:", spill.venner.length + "x"));
  } else if (steg.sum === "kroner") {
    spill.sumSkrevet = true;
    ut.push(kolonner("Total kroner:", spill.kroner + " kr"));
  } else if (steg.slutt === "død") {
    spill.tapt = true;
    spill.grunn = "død";
  }

  return ut;
}

// Nye venner dekker først venner som manglet tidligere i samme svar.
function betalVennegjeld(spill) {
  while (spill.vennegjeld > 0 && spill.venner.length > 0) {
    spill.venner.pop();
    spill.vennegjeld--;
  }
}

/** Utfører alle stegene i et svar (hele historien kommer ut), og sjekker saldoen når
 *  svaret er ferdig: kroner under 0, eller venner som manglet og ikke ble dekket, er tap.
 *  Døden stopper svaret med en gang. */
export function spillSvar(spill, sporsmal, valg) {
  const steg = sporsmal.svar[valg];
  if (!steg) throw new Error(`Spørsmål ${sporsmal.nr} har ikke svaret "${valg}"`);
  const ut = [];
  for (const s of steg) {
    ut.push(...utforSteg(spill, s));
    if (spill.tapt) return ut;
  }
  if (spill.kroner < 0) {
    spill.tapt = true;
    spill.grunn = "kroner";
  } else if (spill.vennegjeld > 0) {
    spill.tapt = true;
    spill.grunn = "venner";
  }
  spill.vennegjeld = 0;
  return ut;
}

/** Overskriften over et svar, med alderen til høyre: "3. Ja --------------------- 23 år" */
export function svarLinje(nr, valg, alder) {
  const venstre = `${nr}. ${valg} `, hoyre = ` ${alder} år`;
  return venstre + "-".repeat(Math.max(0, BREDDE - venstre.length - hoyre.length)) + hoyre;
}

/** Livet er brukt opp før alle valgene er tatt. */
export function tidenErUte(spill, alder) {
  spill.tapt = true;
  spill.grunn = "tid";
  spill.alder = alder;
}

/** Slutten av kvitteringen. `avslutning` er teksten helt til slutt i alle spill (manus.avslutning). */
export function sluttLinjer(spill, avslutning) {
  const ut = ["=".repeat(BREDDE)];
  if (spill.tapt) {
    const grunn = {
      kroner: "Du gikk i minus på kroner.",
      venner: "Du gikk tom for venner.",
      død: "Du døde.",
      tid: `Tiden er ute. Du ble ${spill.alder} år.`,
    }[spill.grunn];
    ut.push("SPILLET ER TAPT", ...brytTekst(grunn));
  } else {
    ut.push("DU KLARTE DET!");
  }
  if (!spill.sumSkrevet) ut.push(spill.visning === "venner"
    ? kolonner("SUM VENNER", spill.venner.length + "x")
    : kolonner("SUM", spill.kroner + " kr"));
  ut.push("=".repeat(BREDDE));
  if (avslutning) ut.push("", ...brytTekst(avslutning));
  return ut;
}

/** Alle veier til seier fra spørsmål nummer `fra` (0-basert), gitt tilstanden `spill`. */
export function vinnerveier(manus, spill, fra) {
  const veier = [];
  (function prov(i, s, vei) {
    if (i === manus.sporsmal.length) { veier.push(vei); return; }
    for (const v of Object.keys(manus.sporsmal[i].svar)) {
      const k = kopi(s);
      spillSvar(k, manus.sporsmal[i], v);
      if (!k.tapt) prov(i + 1, k, [...vei, v]);
    }
  })(fra, spill, []);
  return veier;
}
