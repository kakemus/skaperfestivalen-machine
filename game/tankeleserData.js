// Tankeleseren (2026-10-22): plan B for the machine, for children. The player thinks of one of
// the eight animals on the START screen; the IBM display asks two to four yes/no questions; the
// belt jumps to the animal it has worked out, and it asks "is it this one?". Right: the win light
// and the bell, and a "proof" receipt. Wrong: the belt goes on to DU LURTE MEG! and a diploma
// with a box to draw your own animal in. The receipt is only the souvenir — the game is
// the questions, the belt and the reveal.
//
// Everything a person might want to change is here. The display has 20 characters per line.
// A screen's picture: bilder/<bilde> if it exists (500 × 300, the animal on plain white, like the
// other game's pictures), otherwise the emoji.

/** The animals, in their order on the strip: screen 1, 2, … (screen 0 = START). */
export const DYR = [
  { id: "katt", navn: "KATT", emoji: "🐈", bilde: "dyr-katt.png", fakta: "Katter sover rundt 15 timer hver dag." },
  { id: "hund", navn: "HUND", emoji: "🐕", bilde: "dyr-hund.png", fakta: "En hund lukter mange tusen ganger bedre enn deg." },
  { id: "hest", navn: "HEST", emoji: "🐎", bilde: "dyr-hest.png", fakta: "Hester kan sove stående." },
  { id: "elefant", navn: "ELEFANT", emoji: "🐘", bilde: "dyr-elefant.png", fakta: "Elefanter kan ikke hoppe." },
  { id: "love", navn: "LØVE", emoji: "🦁", bilde: "dyr-love.png", fakta: "Et løvebrøl kan høres åtte kilometer unna." },
  { id: "ugle", navn: "UGLE", emoji: "🦉", bilde: "dyr-ugle.png", fakta: "Ugler kan snu hodet nesten helt rundt." },
  { id: "hai", navn: "HAI", emoji: "🦈", bilde: "dyr-hai.png", fakta: "Haier fantes på jorda før det fantes trær." },
  // a snail, not a snake: Android's snake emoji dithers into something like a duck (2026-10-22)
  { id: "snegle", navn: "SNEGLE", emoji: "🐌", bilde: "dyr-snegle.png", fakta: "En snegle har tusenvis av bittesmå tenner." },
];

/** The last screen: where the belt goes when the player says the guess was wrong. */
export const LURT = { navn: "DU LURTE MEG!", emoji: "❓", bilde: "dyr-lurt.png" };

// The questions, as a tree: each one has the display's two lines (`skjerm`), a short version
// for the receipt (`kort`, at most 24 characters), and where JA and NEI lead — another question,
// or an animal's id. Every animal must be reachable exactly once.
export const SPORSMAL = {
  skjerm: ["HAR DYRET", "FIRE BEIN?"], kort: "Har dyret fire bein?",
  ja: {
    skjerm: ["ER DET STØRRE", "ENN EN VOKSEN?"], kort: "Større enn en voksen?",
    ja: {
      skjerm: ["HAR DET SNABEL?", ""], kort: "Har det snabel?",
      ja: "elefant",
      nei: { skjerm: ["KAN DU RI PÅ DET?", ""], kort: "Kan du ri på det?", ja: "hest", nei: "love" },
    },
    nei: { skjerm: ["SIER DET MJAU?", ""], kort: "Sier det mjau?", ja: "katt", nei: "hund" },
  },
  nei: {
    skjerm: ["KAN DET FLY?", ""], kort: "Kan det fly?",
    ja: "ugle",
    nei: { skjerm: ["BOR DET I VANNET?", ""], kort: "Bor det i vannet?", ja: "hai", nei: "snegle" },
  },
};

export const TEKST = {
  tittel: "TANKELESEREN",
  start: "Tenk på ett av dyrene. Ikke si hvilket!",
  startKnapp: "TRYKK JA FOR Å BEGYNNE",
  gjetter: "Tankeleseren gjetter:",
  bevisTopp: "DU TENKTE PÅ",
  bevisBunn: "Tankeleseren tar nesten aldri feil.",
  diplomTopp: "DIPLOM",
  diplom: "Du lurte Tankeleseren! Tegn dyret du tenkte på:",
  diplomBunn: "Tankeleseren skal øve til neste gang.",
};
