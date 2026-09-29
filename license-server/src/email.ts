export type LicenseEmail = { productName: string; key: string };

/** Sends license keys through Resend (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendLicenseEmail(
  env: { RESEND_API_KEY: string; EMAIL_FROM: string },
  to: string,
  licenses: LicenseEmail[],
): Promise<void> {
  const lines = licenses.map((l) => `${l.productName}: ${l.key}`).join('\n');
  const text = [
    'Thanks for your purchase!',
    '',
    `Your license key${licenses.length > 1 ? 's' : ''}:`,
    '',
    lines,
    '',
    'To activate: click the extension icon in your browser toolbar, paste the key and press Activate.',
    'Keep this email: you can use the same key on all your browsers.',
  ].join('\n');
  const subject = licenses.length === 1 ? `Your ${licenses[0]!.productName} license key` : 'Your license keys';
  if (env.RESEND_API_KEY === 'dry-run') {
    console.log(`[dry-run email] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}: ${await res.text()}`);
}
