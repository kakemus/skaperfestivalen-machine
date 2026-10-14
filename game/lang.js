// Everything the game says, in Norwegian and English (English mode added
// 2026-10-14). The game, the attract lines and the tickets take their words
// from here; the printed strip (START, NIVÅ 1…) is paper and stays as printed.
// Questions keep the "question | JA/NEI" format; YES/NO work as answers too.

export const LANGS = { no: "Norsk", en: "English" };

export const TEXT = {
  no: {
    yesOrNo: "JA ELLER NEI?",
    timeUp: "TIDEN ER UTE!",
    backToStart: "TILBAKE TIL START...",
    wrong: yes => `FEIL! SVARET VAR ${yes ? "JA" : "NEI"}.`,
    right: "RIKTIG!",
    won: "DU VANT!!!",
    thanks: "TAKK FOR SPILLET!",
    coin: "MYNT MOTTATT! LA OSS SPILLE!",
    resetting: "TILBAKESTILLER...",
    attract: ["SETT INN MYNT", "SVAR JA ELLER NEI", "KLATRE HELT TIL TOPPEN", "VINN EN PREMIE!"],
    reward: { title: "NIVÅ {level}!", wonLabel: "DU VANT:", footer: "FORTSETT Å SVARE!" },
    prize: (levels) => ({ result: "DU VANT!", message: `Du klarte alle ${levels} nivåene!` }),
  },
  en: {
    yesOrNo: "YES OR NO?",
    timeUp: "TIME'S UP!",
    backToStart: "BACK TO START...",
    wrong: yes => `WRONG! THE ANSWER WAS ${yes ? "YES" : "NO"}.`,
    right: "CORRECT!",
    won: "YOU WON!!!",
    thanks: "THANKS FOR PLAYING!",
    coin: "COIN IN! LET'S PLAY!",
    resetting: "RESETTING...",
    attract: ["INSERT COIN", "ANSWER YES OR NO", "CLIMB ALL THE WAY UP", "WIN A PRIZE!"],
    reward: {
      title: "LEVEL {level}!", wonLabel: "YOU WON:", footer: "KEEP ANSWERING!",
      rewards: `An invisible piece of cake
A high five from the machine
Permission to cheer out loud
One (1) extra good idea
A lucky number: 7
A gold star
The machine likes you a little more now
A free hug from the nearest grown-up
A secret handshake
Ten seconds of glory`,
    },
    prize: (levels) => ({ result: "YOU WON!", message: `You beat all ${levels} levels!` }),
  },
};

export const DEFAULT_QUESTIONS_EN = `
Is a tomato a fruit? | YES
Can penguins fly? | NO
Does a spider have eight legs? | YES
Is the sun a star? | YES
Is a whale a fish? | NO
Can an ostrich run faster than you? | YES
Is Norway bigger than Sweden? | NO
Does an octopus have three hearts? | YES
Do parrots speak Norwegian? | NO
Is lightning hotter than the sun? | YES
Can horses sleep standing up? | YES
Are bananas blue? | NO
Is Oslo the capital of Norway? | YES
Can a snail sleep for three years? | YES
Is the Moon made of cheese? | NO
Do butterflies taste with their feet? | YES
Is zero an odd number? | NO
Do chickens have teeth? | NO
Is water heavier than ice? | YES
Can a micro:bit talk by radio? | YES
Is Mount Everest in Norway? | NO
Do ants have ears? | NO
Is pi exactly 3? | NO
Is a kilo of lead heavier than a kilo of feathers? | NO
Can elephants jump? | NO
Is the blue whale the biggest animal there is? | YES
Do polar bears live at the South Pole? | NO
Do bees make honey? | YES
Is chocolate dangerous for dogs? | YES
Is this machine clever? | YES
`.trim();
