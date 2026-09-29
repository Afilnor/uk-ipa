import { sendLicenseEmail } from './email.ts';
import { generateLicenseKey, normalizeLicenseKey } from './keys.ts';
import { verifyStripeSignature } from './stripe.ts';

type Product = { name: string; payment_link: string };

export interface Env {
  DB: D1Database;
  VERIFY_LIMITER: RateLimit;
  RECOVER_LIMITER: RateLimit;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  PRODUCTS: Record<string, Product>;
}

// The fields of Stripe objects this Worker reads.
type CheckoutSession = {
  id: string;
  payment_link: string | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  payment_intent: string | null;
  customer_details: { email: string | null } | null;
};
type Charge = { payment_intent: string | null; refunded: boolean };
type StripeEvent = { type: string; data: { object: unknown } };

// The extension calls /verify and /recover from its background script; they hold no cookies, so any origin is fine.
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS_HEADERS } });

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? 'unknown';

async function handleVerify(request: Request, env: Env): Promise<Response> {
  if (!(await env.VERIFY_LIMITER.limit({ key: clientIp(request) })).success) return json({ error: 'rate_limited' }, 429);
  const body = await readJson(request);
  const key = normalizeLicenseKey(body?.key);
  const productId = body?.product_id;
  if (!key || typeof productId !== 'string') return json({ paid: false });
  const row = await env.DB.prepare('SELECT 1 FROM licenses WHERE key = ? AND product_id = ? AND revoked_at IS NULL')
    .bind(key, productId)
    .first();
  return json({ paid: row !== null });
}

async function handleRecover(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
  const limited = await Promise.all([
    env.RECOVER_LIMITER.limit({ key: `ip:${clientIp(request)}` }),
    env.RECOVER_LIMITER.limit({ key: `email:${email}` }),
  ]);
  if (limited.some((r) => !r.success)) return json({ error: 'rate_limited' }, 429);

  const { results } = await env.DB.prepare(
    `SELECT l.key, l.product_id FROM licenses l JOIN customers c ON c.id = l.customer_id
     WHERE c.email = ? AND l.revoked_at IS NULL ORDER BY l.created_at`,
  )
    .bind(email)
    .all<{ key: string; product_id: string }>();
  if (results.length) {
    const licenses = results.map((r) => ({ key: r.key, productName: env.PRODUCTS[r.product_id]?.name ?? r.product_id }));
    await sendLicenseEmail(env, email, licenses);
  }
  // Same answer whether or not the email bought anything, so the endpoint can't be used to look up customers.
  return json({ ok: true });
}

/** Creates the license for a paid Checkout Session and emails it. Safe to run again when Stripe retries. */
async function fulfill(session: CheckoutSession, env: Env): Promise<Response> {
  const entry = Object.entries(env.PRODUCTS).find(([, p]) => p.payment_link === session.payment_link);
  if (!entry) {
    console.log(`Ignoring session ${session.id}: payment link ${session.payment_link} is not a known product`);
    return new Response('ignored', { status: 200 });
  }
  const [productId, product] = entry;
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) return new Response('session has no customer email', { status: 400 });

  await env.DB.prepare('INSERT INTO customers (email) VALUES (?) ON CONFLICT (email) DO NOTHING').bind(email).run();
  const customer = await env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first<{ id: number }>();
  if (!customer) throw new Error(`Customer ${email} missing right after insert`);

  await env.DB.prepare(
    `INSERT INTO licenses (key, customer_id, product_id, stripe_session_id, stripe_payment_intent)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT (stripe_session_id) DO NOTHING`,
  )
    .bind(generateLicenseKey(), customer.id, productId, session.id, session.payment_intent)
    .run();
  const license = await env.DB.prepare('SELECT key, emailed_at FROM licenses WHERE stripe_session_id = ?')
    .bind(session.id)
    .first<{ key: string; emailed_at: string | null }>();
  if (!license) throw new Error(`License for session ${session.id} missing right after insert`);

  if (!license.emailed_at) {
    // If this throws, the webhook returns 500 and Stripe retries; the key stays the same.
    await sendLicenseEmail(env, email, [{ productName: product.name, key: license.key }]);
    await env.DB.prepare("UPDATE licenses SET emailed_at = datetime('now') WHERE key = ?").bind(license.key).run();
  }
  return new Response('ok');
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (!(await verifyStripeSignature(body, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET))) {
    return new Response('invalid signature', { status: 400 });
  }
  const event = JSON.parse(body) as StripeEvent;
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as CheckoutSession;
      // Delayed payment methods (e.g. bank debits) complete later with async_payment_succeeded.
      return session.payment_status === 'paid' ? fulfill(session, env) : new Response('awaiting payment');
    }
    case 'checkout.session.async_payment_succeeded':
      return fulfill(event.data.object as CheckoutSession, env);
    case 'charge.refunded': {
      const charge = event.data.object as Charge;
      if (charge.refunded && charge.payment_intent) {
        await env.DB.prepare("UPDATE licenses SET revoked_at = datetime('now') WHERE stripe_payment_intent = ? AND revoked_at IS NULL")
          .bind(charge.payment_intent)
          .run();
      }
      return new Response('ok');
    }
    default:
      return new Response('ignored');
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method === 'GET' && pathname === '/') return new Response('UK IPA license server');
    if (request.method !== 'POST') return new Response('Not found', { status: 404 });
    try {
      switch (pathname) {
        case '/verify':
          return await handleVerify(request, env);
        case '/recover':
          return await handleRecover(request, env);
        case '/stripe-webhook':
          return await handleStripeWebhook(request, env);
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (err) {
      console.error(err);
      return json({ error: 'internal_error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
