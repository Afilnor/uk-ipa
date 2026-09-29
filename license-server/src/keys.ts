// Crockford-style alphabet: no I, L, O or U, so keys are easy to read and type.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A random license key like UKIPA-7K3Q-M9XD-2VHT-P4RW (80 bits of randomness). */
export function generateLicenseKey(prefix = 'UKIPA'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => ALPHABET[b % 32]).join('');
  return [prefix, chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12), chars.slice(12, 16)].join('-');
}

export function normalizeLicenseKey(key: unknown): string | null {
  if (typeof key !== 'string') return null;
  const k = key.trim().toUpperCase();
  return /^[A-Z]{2,10}(-[0-9A-Z]{4}){4}$/.test(k) ? k : null;
}
