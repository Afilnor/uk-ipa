import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addVariant,
  bestBritishIpa,
  mergeDatasets,
  normalizeIpa,
  normalizeWord,
  parseIpaDictLine,
  serializeDictionary,
} from '../scripts/dataset-lib.ts';

test('normalizeWord keeps single words and drops phrases, digits and symbols', () => {
  assert.equal(normalizeWord('Café'), 'café');
  assert.equal(normalizeWord('don’t'), "don't");
  assert.equal(normalizeWord('well-known'), 'well-known');
  assert.equal(normalizeWord('sign up'), null);
  assert.equal(normalizeWord('mp3'), null);
  assert.equal(normalizeWord('sched.'), null);
});

test('normalizeIpa strips slashes and syllable dots, rejects phonetic and partial forms', () => {
  assert.equal(normalizeIpa('/ˈdɪk.ʃə.nə.ɹi/'), 'ˈdɪkʃənəɹi');
  assert.equal(normalizeIpa('[ˈkʰæt]'), null);
  assert.equal(normalizeIpa('/ɛn-/'), null);
});

test('bestBritishIpa prefers RP, then UK, then standard British, then untagged; skips other accents', () => {
  assert.equal(
    bestBritishIpa({ sounds: [
      { ipa: '/ˈwɔ.tɚ/', tags: ['General-American'] },
      { ipa: '/ˈwɔː.tə/', tags: ['UK'] },
      { ipa: '/ˈwɔː.tə(ɹ)/', tags: ['Received-Pronunciation'] },
    ] }),
    'ˈwɔːtə(ɹ)',
  );
  assert.equal(bestBritishIpa({ sounds: [{ ipa: '/bʉk/', tags: ['Scotland'] }] }), null);
  assert.equal(bestBritishIpa({ sounds: [{ ipa: '/lɪst/' }] }), 'lɪst');
  assert.equal(bestBritishIpa({ sounds: [{ ipa: '/ˈwɔtɚ/' }] }), null);
  assert.equal(bestBritishIpa({ sounds: [{ ipa: '/bɵk/', tags: ['British', 'Southern', 'Standard'] }] }), 'bɵk');
});

test('parseIpaDictLine handles both variant styles', () => {
  assert.deepEqual(parseIpaDictLine('the\t/ðə, ði/'), { word: 'the', variants: ['ðə', 'ði'] });
  assert.deepEqual(parseIpaDictLine('read\t/ɹˈiːd/, /ɹˈɛd/'), { word: 'read', variants: ['ɹˈiːd', 'ɹˈɛd'] });
  assert.equal(parseIpaDictLine('garbage'), null);
});

test('addVariant dedupes and caps at two variants', () => {
  const map = new Map<string, string[]>();
  for (const v of ['a', 'a', 'b', 'c']) addVariant(map, 'w', v);
  assert.deepEqual(map.get('w'), ['a', 'b']);
});

test('mergeDatasets keeps Wiktionary on collisions and fills gaps from ipa-dict', () => {
  const wiktionary = new Map([['tomato', ['təˈmɑːtəʊ']]]);
  const ipaDict = new Map([['tomato', ['təmˈɑːtəʊ']], ['aardvark', ['ˈɑːdvɑːk']]]);
  const { merged, stats } = mergeDatasets(wiktionary, ipaDict);
  assert.equal(merged.get('tomato'), 'təˈmɑːtəʊ');
  assert.equal(merged.get('aardvark'), 'ˈɑːdvɑːk');
  assert.deepEqual(stats, { wiktionary: 1, ipaDictOnly: 1, overlap: 1, total: 2 });
});

test('serializeDictionary sorts words, one per line, as valid JSON', () => {
  const text = serializeDictionary(new Map([['b', 'bɪ'], ['a', 'eɪ']]));
  assert.equal(text, '{\n"a":"eɪ",\n"b":"bɪ"\n}\n');
  assert.deepEqual(JSON.parse(text), { a: 'eɪ', b: 'bɪ' });
});
