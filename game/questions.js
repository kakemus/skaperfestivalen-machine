// The default question list — one per line, "question | JA" or "question | NEI".
// The sidebar shows this as editable text; edits are saved in the browser and
// only fall back to this list when nothing is saved. Keep questions short:
// the IBM display fits 2 x 20 letters (longer ones scroll).
export const DEFAULT_QUESTIONS = `
Er en tomat en frukt? | JA
Kan pingviner fly? | NEI
Har en edderkopp åtte bein? | JA
Er sola en stjerne? | JA
Er hvalen en fisk? | NEI
Kan en strutse løpe fortere enn deg? | JA
Er Norge større enn Sverige? | NEI
Har en blekksprut tre hjerter? | JA
Snakker papegøyer norsk? | NEI
Er lyn varmere enn sola? | JA
Sover hester stående? | JA
Er bananer blå? | NEI
Er Oslo hovedstaden i Norge? | JA
Kan en snegle sove i tre år? | JA
Er Månen laget av ost? | NEI
Har en sommerfugl smak i føttene? | JA
Er null et oddetall? | NEI
Har kyllinger tenner? | NEI
Er vann tyngre enn is? | JA
Kan en mikrobit snakke radio? | JA
Er Mount Everest i Norge? | NEI
Har maur ører? | NEI
Er pi nøyaktig 3? | NEI
Er en kilo bly tyngre enn en kilo fjær? | NEI
Kan elefanter hoppe? | NEI
Er blåhvalen det største dyret som finnes? | JA
Lever isbjørner på Sydpolen? | NEI
Lager bier honning? | JA
Er sjokolade farlig for hunder? | JA
Er denne maskinen smart? | JA
`.trim();

/** "text | JA" lines → [{ text, answer: true/false }], skipping blank or broken lines. */
export function parseQuestions(text) {
  return String(text).split("\n").map(line => {
    const [q, a] = line.split("|").map(s => s && s.trim());
    if (!q || !a) return null;
    const yes = /^(ja|j|yes|y|true|1)$/i.test(a);
    const no = /^(nei|n|no|false|0)$/i.test(a);
    return yes || no ? { text: q, answer: yes } : null;
  }).filter(Boolean);
}
