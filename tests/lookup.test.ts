import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidates, formatIpa, lookup, normalizeSelection } from '../utils/lookup.ts';

const dict = { run: 'ɹʌn', stop: 'stɒp', make: 'meɪk', city: 'ˈsɪti', "don't": 'dəʊnt', the: 'ðə, ði' };

test('normalizeSelection lowercases, straightens apostrophes and trims punctuation', () => {
  assert.equal(normalizeSelection('“Don’t,”'), "don't");
  assert.equal(normalizeSelection('(Run)'), 'run');
});

test('exact matches win', () => {
  assert.deepEqual(lookup(dict, 'Run'), { word: 'run', ipa: 'ɹʌn' });
});

test('falls back to base forms of inflections', () => {
  assert.equal(lookup(dict, 'running')?.word, 'run');
  assert.equal(lookup(dict, 'stopped')?.word, 'stop');
  assert.equal(lookup(dict, 'making')?.word, 'make');
  assert.equal(lookup(dict, 'cities')?.word, 'city');
  assert.equal(lookup(dict, 'runs')?.word, 'run');
});

test('unknown and prototype-named words are not found', () => {
  assert.equal(lookup(dict, 'qwxzv'), null);
  assert.equal(lookup(dict, 'constructor'), null);
  assert.equal(lookup(dict, '!!!'), null);
});

test('candidates starts with the word itself', () => {
  assert.equal(candidates('glasses')[0], 'glasses');
});

test('formatIpa wraps each variant in slashes', () => {
  assert.equal(formatIpa('ðə, ði'), '/ðə/, /ði/');
});
