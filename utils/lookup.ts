export type Dictionary = Record<string, string>;

/** The selected text as a dictionary key: lowercase, curly apostrophes straightened, edge punctuation removed. */
export function normalizeSelection(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

/** The word itself, then likely base forms for common English inflections ("running" -> "run"). */
export function candidates(word: string): string[] {
  const out = [word];
  const add = (w: string) => w.length > 1 && !out.includes(w) && out.push(w);
  const undouble = (stem: string) => (/([bdfgklmnprtvz])\1$/.test(stem) ? stem.slice(0, -1) : stem);

  if (word.endsWith("'s")) add(word.slice(0, -2));
  if (word.endsWith('ies')) add(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) add(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1));
  if (word.endsWith('ied')) add(`${word.slice(0, -3)}y`);
  if (word.endsWith('ed')) {
    const stem = word.slice(0, -2);
    add(stem);
    add(`${stem}e`);
    add(undouble(stem));
  }
  if (word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    add(stem);
    add(`${stem}e`);
    add(undouble(stem));
  }
  return out;
}

/** Looks a selection up, trying base forms when the exact word is missing. `word` is the entry that matched. */
export function lookup(dict: Dictionary, text: string): { word: string; ipa: string } | null {
  const word = normalizeSelection(text);
  if (!word) return null;
  for (const candidate of candidates(word)) {
    if (Object.hasOwn(dict, candidate)) return { word: candidate, ipa: dict[candidate] as string };
  }
  return null;
}

/** "ðə, ði" -> "/ðə/, /ði/" */
export function formatIpa(ipa: string): string {
  return ipa
    .split(', ')
    .map((v) => `/${v}/`)
    .join(', ');
}
