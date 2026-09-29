import { browser } from 'wxt/browser';
import { LICENSE_API_URL, PRODUCT_ID, REQUIRE_LICENSE } from './config';
import type { LicenseStatus } from './messages';

const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;

// The key syncs across the user's browsers; the verification result is cached per device.
type Cached = { paid: boolean; checkedAt: number };

async function getKey(): Promise<string | null> {
  const { licenseKey } = await browser.storage.sync.get('licenseKey');
  return typeof licenseKey === 'string' ? licenseKey : null;
}

async function getCached(): Promise<Cached | null> {
  const { licenseCache } = await browser.storage.local.get('licenseCache');
  return (licenseCache as Cached | undefined) ?? null;
}

async function verifyRemote(key: string): Promise<boolean> {
  const res = await fetch(`${LICENSE_API_URL}/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key, product_id: PRODUCT_ID }),
  });
  if (!res.ok) throw new Error(`License server returned ${res.status}`);
  return ((await res.json()) as { paid?: boolean }).paid === true;
}

/**
 * Free builds mark the install, so that users who installed UK IPA while it was free keep it free
 * once a paid version ships. Remove the early-adopter check in isPaid() to drop that promise.
 */
export async function recordFreeInstall(): Promise<void> {
  if (REQUIRE_LICENSE) return;
  const { freeSince } = await browser.storage.sync.get('freeSince');
  if (!freeSince) await browser.storage.sync.set({ freeSince: new Date().toISOString() });
}

async function isEarlyAdopter(): Promise<boolean> {
  const { freeSince } = await browser.storage.sync.get('freeSince');
  return typeof freeSince === 'string';
}

/** Whether lookups are unlocked. Checks the server at most once a day; offline, the last result stands. */
export async function isPaid(): Promise<boolean> {
  if (!REQUIRE_LICENSE || (await isEarlyAdopter())) return true;
  const key = await getKey();
  if (!key) return false;
  const cached = await getCached();
  if (cached && Date.now() - cached.checkedAt < VERIFY_INTERVAL_MS) return cached.paid;
  try {
    const paid = await verifyRemote(key);
    await browser.storage.local.set({ licenseCache: { paid, checkedAt: Date.now() } satisfies Cached });
    return paid;
  } catch {
    return cached?.paid ?? false;
  }
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (!REQUIRE_LICENSE) return { paid: true, key: null, free: 'free_build' };
  if (await isEarlyAdopter()) return { paid: true, key: null, free: 'early_adopter' };
  return { paid: await isPaid(), key: await getKey() };
}

export async function activate(rawKey: string): Promise<LicenseStatus> {
  const key = rawKey.trim().toUpperCase();
  if (!key) return { paid: false, key: null, error: 'Enter your license key.' };
  let paid: boolean;
  try {
    paid = await verifyRemote(key);
  } catch {
    return { paid: false, key: await getKey(), error: 'Could not reach the license server. Try again later.' };
  }
  if (!paid) return { paid: false, key: await getKey(), error: 'This license key is not valid.' };
  await browser.storage.sync.set({ licenseKey: key });
  await browser.storage.local.set({ licenseCache: { paid: true, checkedAt: Date.now() } satisfies Cached });
  return { paid: true, key };
}

export async function deactivate(): Promise<LicenseStatus> {
  await browser.storage.sync.remove('licenseKey');
  await browser.storage.local.remove('licenseCache');
  return { paid: false, key: null };
}

export async function recover(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${LICENSE_API_URL}/recover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (res.status === 429) return { ok: false, error: 'Too many attempts. Try again in a few minutes.' };
    if (!res.ok) return { ok: false, error: 'Something went wrong. Try again later.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the license server. Try again later.' };
  }
}
