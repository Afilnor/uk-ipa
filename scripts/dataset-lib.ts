// Pure helpers for refresh-dataset.ts, kept separate so they can be unit tested.

export type WiktextractSound = { ipa?: string; tags?: string[]; raw_tags?: string[] };
export type WiktextractEntry = { word?: string; lang_code?: string; pos?: string; sounds?: WiktextractSound[] };

const WORD_RE = /^\p{L}+(?:['-]\p{L}+)*$/u;

// Tags that mark a regional British accent rather than the standard one we want.
const REGIONAL_TAGS = new Set([
  'Scotland', 'Scottish', 'Northern-Ireland', 'Ireland', 'Wales', 'Welsh',
  'Northern', 'Northern-England', 'Yorkshire', 'Geordie', 'Scouse', 'Cockney',
  'Estuary', 'Multicultural-London-English', 'West-Country', 'Brummie',
]);
const STANDARD_BRITISH_TAGS = new Set(['British', 'Southern', 'Standard']);

/** Returns a normalized headword, or null when the word should be dropped. */
export function normalizeWord(word: string): string | null {
  const w = word.normalize('NFC').replace(/[’‘]/g, "'").trim().toLowerCase();
  return WORD_RE.test(w) ? w : null;
}

/** Strips the surrounding /…/ and Wiktionary's syllable dots. Returns null for fragments like "/ɛn-/". */
export function normalizeIpa(ipa: string): string | null {
  let s = ipa.normalize('NFC').trim();
  if (!s.startsWith('/') || !s.endsWith('/') || s.length < 3) return null; // skip phonetic [..] transcriptions
  s = s.slice(1, -1).replace(/\./g, '').trim();
  if (!s || s.startsWith('-') || s.endsWith('-') || /[…,;\/\[\]]/.test(s)) return null;
  return s;
}

// American-only sounds (r-coloured vowels, flapped t) rule out an untagged transcription.
const AMERICAN_IPA_RE = /[ɚɝɾ]/;

/**
 * 0 = Received Pronunciation, 1 = UK, 2 = Standard Southern British,
 * 3 = untagged (Wiktionary's accent-neutral transcription), null = another accent.
 */
export function britishRank(sound: WiktextractSound): number | null {
  const tags = [...(sound.tags ?? []), ...(sound.raw_tags ?? [])];
  if (tags.length === 0) return sound.ipa && !AMERICAN_IPA_RE.test(sound.ipa) ? 3 : null;
  if (tags.some((t) => REGIONAL_TAGS.has(t))) return null;
  if (tags.includes('Received-Pronunciation')) return 0;
  if (tags.includes('UK')) return 1;
  if (tags.includes('British') && tags.every((t) => STANDARD_BRITISH_TAGS.has(t))) return 2;
  return null;
}

/** The best British phonemic IPA of one Wiktextract entry (one word + part of speech). */
export function bestBritishIpa(entry: WiktextractEntry): string | null {
  let best: { rank: number; ipa: string } | null = null;
  for (const sound of entry.sounds ?? []) {
    if (!sound.ipa) continue;
    const rank = britishRank(sound);
    if (rank === null || (best && best.rank <= rank)) continue;
    const ipa = normalizeIpa(sound.ipa);
    if (ipa) best = { rank, ipa };
  }
  return best?.ipa ?? null;
}

/** Parses one ipa-dict line ("word\t/a/, /b/" or "word\t/a, b/") into a word and its IPA variants. */
export function parseIpaDictLine(line: string): { word: string; variants: string[] } | null {
  const [rawWord, rawIpa] = line.split('\t');
  if (!rawWord || !rawIpa) return null;
  const word = normalizeWord(rawWord);
  if (!word) return null;
  const variants = rawIpa
    .split(',')
    .map((v) => v.trim().replace(/^\/|\/$/g, '').trim())
    .filter(Boolean);
  return variants.length ? { word, variants } : null;
}

export const MAX_VARIANTS = 2;

/** Adds a variant to a word's list, keeping order, skipping duplicates and capping the count. */
export function addVariant(map: Map<string, string[]>, word: string, ipa: string): void {
  const list = map.get(word);
  if (!list) map.set(word, [ipa]);
  else if (list.length < MAX_VARIANTS && !list.includes(ipa)) list.push(ipa);
}

export type MergeStats = { wiktionary: number; ipaDictOnly: number; overlap: number; total: number };

/** Wiktionary wins on collisions; ipa-dict only fills words Wiktionary lacks. */
export function mergeDatasets(
  wiktionary: Map<string, string[]>,
  ipaDict: Map<string, string[]>,
): { merged: Map<string, string>; stats: MergeStats } {
  const merged = new Map<string, string>();
  let overlap = 0;
  for (const [word, variants] of wiktionary) merged.set(word, variants.join(', '));
  for (const [word, variants] of ipaDict) {
    if (merged.has(word)) overlap++;
    else merged.set(word, variants.join(', '));
  }
  return {
    merged,
    stats: { wiktionary: wiktionary.size, ipaDictOnly: merged.size - wiktionary.size, overlap, total: merged.size },
  };
}

/** One entry per line and sorted, so dataset refreshes produce readable diffs. */
export function serializeDictionary(dict: Map<string, string>): string {
  const lines = [...dict.keys()]
    .sort()
    .map((word) => `${JSON.stringify(word)}:${JSON.stringify(dict.get(word))}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
