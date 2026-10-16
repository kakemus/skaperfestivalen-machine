// The cards of the life simulator (2026-10-16): one per screen of the scroll,
// START first. Each line:  title | price | JA or NEI | text when you lose here
//   JA  = the card is a purchase you should make; NEI = a trap you should refuse.
//   The last part is optional: printed when you choose wrong on this card (the
//   default texts below otherwise). Prices in kroner, spaces allowed.
// The maker writes the real story; these are placeholders. The last card is the
// jackpot (the machine itself), and FINAL_TEXT is printed when it's bought.

export const DEFAULT_CARDS = `
Første mobiltelefon | 4 990 | JA
Fire strømmeabonnementer | 2 400 | JA
Studielån | 150 000 | JA
Lån med 39 % rente, bare i dag | 50 000 | NEI | SKULLE IKKE HA KJØPT. INKASSO. TILBAKE TIL START.
Brukt Volvo 240 | 45 000 | JA
Elsparkesykkel | 12 000 | JA
«Gratis» kryptokurs | 9 990 | NEI | DU KJØPTE ET KURS I Å KJØPE KURS. TILBAKE TIL START.
Leilighet i Oslo | 5 200 000 | JA
Hytte på fjellet | 2 500 000 | JA
Bli din egen sjef (pyramide) | 25 000 | NEI | NÅ ER DU DIN EGEN SJEF OG DIN EGEN KREDITOR. TILBAKE TIL START.
Elbil | 450 000 | JA
Smarthus med AI-kjøleskap | 89 000 | JA
Utvidet garanti på alt | 19 990 | NEI | GARANTIEN DEKKET IKKE DETTE. TILBAKE TIL START.
Livsforsikring | 4 990 | JA
Brukt arkademaskin (inkl. alt innhold og nøkler) | 10 000 | JA
`.trim();

export const TEXTS = {
  shouldHaveBought: "SKULLE HA KJØPT. TILBAKE TIL START.",
  shouldNotHaveBought: "SKULLE IKKE HA KJØPT. TILBAKE TIL START.",
  tooSlow: "FOR TREIG. SKULLE HA KJØPT. TILBAKE TIL START.",
  refused: "AVSLÅTT",
};

// Printed after the jackpot card is bought (the maker's ending, without the phone number).
export const FINAL_TEXT = `TRANSAKSJON REGISTRERT
STATUS: VENTER PÅ MANUELL BEKREFTELSE.
STENER ER PÅ VEI FOR Å OVERREKKE DEG MASKINEN.
MERK: MASKINEN BLIR IKKE UTLEVERT FØR STENER HAR BEKREFTET PENGENE PÅ KONTO.
DU ER NÅ LYKKELIG PÅ EKTE.`;

/** "title | price | JA | text" lines → [{ title, price, buy, lose }], broken lines skipped. */
export function parseCards(text) {
  return String(text).split("\n").map(line => {
    const [title, price, answer, lose] = line.split("|").map(s => s && s.trim());
    if (!title || !answer) return null;
    const buy = /^(ja|j|yes|y)$/i.test(answer), refuse = /^(nei|n|no)$/i.test(answer);
    if (!buy && !refuse) return null;
    return { title, price: Number(String(price || "0").replace(/[^\d]/g, "")) || 0, buy, lose: lose || "" };
  }).filter(Boolean);
}

/** 1234567 → "1 234 567" */
export const kroner = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
