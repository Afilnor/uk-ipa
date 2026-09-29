// Rebuilds public/dict/en_UK.json from Wiktionary (via kaikki.org) and ipa-dict.
// Run locally with `npm run refresh-dataset` (add `-- --cache` to keep downloads in .dataset-cache/),
// or from GitHub via the "Refresh dataset" workflow. It is not part of the extension build.

import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { Readable, type Readable as ReadableType } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import {
  addVariant,
  bestBritishIpa,
  mergeDatasets,
  normalizeWord,
  parseIpaDictLine,
  serializeDictionary,
  type WiktextractEntry,
} from './dataset-lib.ts';

const WIKTIONARY_URL = 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz';
const IPA_DICT_REPO = 'open-dict-data/ipa-dict';
const IPA_DICT_PATH = 'data/en_UK.txt';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT_DICT = `${ROOT}public/dict/en_UK.json`;
const OUT_SOURCES = `${ROOT}public/dict/SOURCES.json`;
const CACHE_DIR = `${ROOT}.dataset-cache`;
const useCache = process.argv.includes('--cache');

/** Splits a byte stream on "\n" only. node:readline also splits on U+2028/U+2029, which occur inside JSON strings. */
async function* splitLines(stream: ReadableType): AsyncIterable<string> {
  let rest = '';
  stream.setEncoding('utf8');
  for await (const chunk of stream as AsyncIterable<string>) {
    const parts = (rest + chunk).split('\n');
    rest = parts.pop() ?? '';
    yield* parts;
  }
  if (rest) yield rest;
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'user-agent': 'uk-ipa-refresh-dataset' } });
  if (!res.ok || !res.body) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res;
}

/** Streams the gzipped Wiktextract dump, optionally through a local cache. Returns its Last-Modified date. */
async function openWiktionary(): Promise<{ lines: AsyncIterable<string>; version: string }> {
  const cacheFile = `${CACHE_DIR}/kaikki-English.jsonl.gz`;
  let version = 'unknown';
  if (useCache && existsSync(cacheFile)) {
    console.log(`Using cached ${cacheFile}`);
    version = (await readFile(`${cacheFile}.version`, 'utf8').catch(() => 'unknown')).trim();
  } else {
    console.log(`Downloading ${WIKTIONARY_URL} (about 500 MB)…`);
    const res = await fetchOk(WIKTIONARY_URL);
    version = res.headers.get('last-modified') ?? 'unknown';
    if (useCache) {
      await mkdir(CACHE_DIR, { recursive: true });
      await pipeline(Readable.fromWeb(res.body as any), createWriteStream(`${cacheFile}.part`));
      await rename(`${cacheFile}.part`, cacheFile);
      await writeFile(`${cacheFile}.version`, version);
    } else {
      const stream = Readable.fromWeb(res.body as any).pipe(createGunzip());
      return { lines: splitLines(stream), version };
    }
  }
  const stream = createReadStream(cacheFile).pipe(createGunzip());
  return { lines: splitLines(stream), version };
}

async function loadWiktionary() {
  const { lines, version } = await openWiktionary();
  // Lowercase headwords win over capitalized ones ("polish" before "Polish").
  const lower = new Map<string, string[]>();
  const capitalized = new Map<string, string[]>();
  let entries = 0;
  for await (const line of lines) {
    if (++entries % 200_000 === 0) console.log(`  …${entries.toLocaleString()} Wiktionary entries read`);
    // Cheap pre-filter: skip the many entries (mostly inflected forms) without any IPA.
    if (!line.includes('"ipa"')) continue;
    const entry = JSON.parse(line) as WiktextractEntry;
    if (entry.lang_code !== 'en' || !entry.word) continue;
    const word = normalizeWord(entry.word);
    const ipa = word && bestBritishIpa(entry);
    if (!word || !ipa) continue;
    addVariant(entry.word === word ? lower : capitalized, word, ipa);
  }
  for (const [word, variants] of capitalized) if (!lower.has(word)) lower.set(word, variants);
  console.log(`Wiktionary: ${lower.size.toLocaleString()} words from ${entries.toLocaleString()} entries`);
  return { words: lower, version };
}

async function loadIpaDict() {
  const commit = (await (await fetchOk(`https://api.github.com/repos/${IPA_DICT_REPO}/commits/HEAD`)).json()).sha as string;
  const url = `https://raw.githubusercontent.com/${IPA_DICT_REPO}/${commit}/${IPA_DICT_PATH}`;
  console.log(`Downloading ${url}`);
  const text = await (await fetchOk(url)).text();
  const words = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    const parsed = parseIpaDictLine(line);
    if (parsed) for (const v of parsed.variants) addVariant(words, parsed.word, v);
  }
  console.log(`ipa-dict: ${words.size.toLocaleString()} words (commit ${commit.slice(0, 7)})`);
  return { words, url, commit };
}

async function main() {
  const [wiktionary, ipaDict] = await Promise.all([loadWiktionary(), loadIpaDict()]);
  const { merged, stats } = mergeDatasets(wiktionary.words, ipaDict.words);

  const previous: Record<string, string> = existsSync(OUT_DICT) ? JSON.parse(await readFile(OUT_DICT, 'utf8')) : {};
  let added = 0, changed = 0;
  for (const [word, ipa] of merged) {
    if (!Object.hasOwn(previous, word)) added++;
    else if (previous[word] !== ipa) changed++;
  }
  const removed = Object.keys(previous).filter((w) => !merged.has(w)).length;

  const summary = [
    '## Dataset refresh',
    '',
    `| | Words |`,
    `|---|---:|`,
    `| Total | ${stats.total.toLocaleString()} |`,
    `| From Wiktionary | ${stats.wiktionary.toLocaleString()} |`,
    `| From ipa-dict (not in Wiktionary) | ${stats.ipaDictOnly.toLocaleString()} |`,
    `| In both (Wiktionary kept) | ${stats.overlap.toLocaleString()} |`,
    `| Added since last refresh | ${added.toLocaleString()} |`,
    `| Changed since last refresh | ${changed.toLocaleString()} |`,
    `| Removed since last refresh | ${removed.toLocaleString()} |`,
  ].join('\n');
  console.log(`\n${summary}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);

  if (!added && !changed && !removed) {
    console.log('No changes; leaving files untouched.');
    return;
  }

  await mkdir(`${ROOT}public/dict`, { recursive: true });
  await writeFile(OUT_DICT, serializeDictionary(merged));
  const sources = {
    generatedAt: new Date().toISOString(),
    license: 'GPL-3.0-or-later (see THIRD_PARTY_NOTICES.md)',
    counts: stats,
    sources: [
      { name: 'Wiktionary (via kaikki.org / Wiktextract)', url: WIKTIONARY_URL, version: wiktionary.version, license: 'CC BY-SA 4.0', priority: 1 },
      { name: 'ipa-dict en_UK (derived from ipacards)', url: ipaDict.url, version: ipaDict.commit, license: 'GPL-3.0', priority: 2 },
    ],
  };
  await writeFile(OUT_SOURCES, `${JSON.stringify(sources, null, 2)}\n`);
  console.log(`Wrote ${OUT_DICT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
