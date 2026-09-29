import { browser } from 'wxt/browser';
import { PAYMENT_LINK_URL } from '@/utils/config';
import type { LicenseStatus, Message } from '@/utils/messages';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T>(message: Message) => browser.runtime.sendMessage(message) as Promise<T>;

function setMessage(text: string, isError = false) {
  const el = $('message');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function render(status: LicenseStatus) {
  $('status').hidden = true;
  $('free').hidden = !status.free;
  $('free-note').textContent =
    status.free === 'early_adopter' ? 'You installed UK IPA while it was free, so it stays free for you.' : 'Free, and works offline.';
  $('locked').hidden = status.paid;
  $('unlocked').hidden = !status.paid || Boolean(status.free);
  $('current-key').textContent = status.key ?? '';
  if (status.error) setMessage(status.error, true);
}

async function withBusy(form: HTMLElement, fn: () => Promise<void>) {
  const buttons = form.querySelectorAll('button');
  buttons.forEach((b) => (b.disabled = true));
  try {
    await fn();
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

$('buy').addEventListener('click', () => {
  browser.tabs.create({ url: PAYMENT_LINK_URL });
});

$<HTMLFormElement>('activate-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  withBusy(form, async () => {
    setMessage('');
    const status = await send<LicenseStatus>({ type: 'ACTIVATE', key: $<HTMLInputElement>('key').value });
    render(status);
    if (status.paid) setMessage('Thanks! UK IPA is unlocked.');
  });
});

$<HTMLFormElement>('recover-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  withBusy(form, async () => {
    const result = await send<{ ok: boolean; error?: string }>({ type: 'RECOVER', email: $<HTMLInputElement>('email').value });
    if (result.ok) setMessage('If that email bought UK IPA, the license key is on its way.');
    else setMessage(result.error ?? 'Something went wrong.', true);
  });
});

$('deactivate').addEventListener('click', async () => {
  setMessage('');
  render(await send<LicenseStatus>({ type: 'DEACTIVATE' }));
});

send<LicenseStatus>({ type: 'GET_LICENSE' }).then(render);
