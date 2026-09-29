// Stripe webhook signature check with Web Crypto, so the Worker needs no Stripe SDK.
// https://docs.stripe.com/webhooks#verify-manually

const TOLERANCE_SECONDS = 300;

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when `header` (Stripe-Signature) is a valid, recent signature of `body`. */
export async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.trim().split('=', 2) as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  return signatures.some((s) => timingSafeEqual(s, expected));
}

/** Builds a Stripe-Signature header; used by tests and local webhook simulation. */
export async function signStripePayload(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${timestamp},v1=${await hmacSha256Hex(secret, `${timestamp}.${body}`)}`;
}
