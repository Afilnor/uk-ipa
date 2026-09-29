import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signStripePayload, verifyStripeSignature } from '../src/stripe.ts';
import { generateLicenseKey, normalizeLicenseKey } from '../src/keys.ts';

const secret = 'whsec_test';
const body = '{"type":"checkout.session.completed"}';

test('accepts a valid, recent signature', async () => {
  const header = await signStripePayload(body, secret, 1_000_000);
  assert.equal(await verifyStripeSignature(body, header, secret, 1_000_010), true);
});

test('rejects tampered bodies, wrong secrets, stale timestamps and missing headers', async () => {
  const header = await signStripePayload(body, secret, 1_000_000);
  assert.equal(await verifyStripeSignature(`${body} `, header, secret, 1_000_000), false);
  assert.equal(await verifyStripeSignature(body, header, 'whsec_other', 1_000_000), false);
  assert.equal(await verifyStripeSignature(body, header, secret, 1_000_000 + 301), false);
  assert.equal(await verifyStripeSignature(body, null, secret), false);
  assert.equal(await verifyStripeSignature(body, 't=abc,v1=00', secret), false);
});

test('license keys are well-formed, unique and normalize case', () => {
  const key = generateLicenseKey();
  assert.match(key, /^UKIPA(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
  assert.notEqual(key, generateLicenseKey());
  assert.equal(normalizeLicenseKey(` ${key.toLowerCase()} `), key);
  assert.equal(normalizeLicenseKey('nope'), null);
  assert.equal(normalizeLicenseKey(42), null);
});
