import { browser } from 'wxt/browser';
import { activate, deactivate, getLicenseStatus, isPaid, recordFreeInstall, recover } from '@/utils/license';
import { lookup, type Dictionary } from '@/utils/lookup';
import type { LookupResult, Message } from '@/utils/messages';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void recordFreeInstall());

  // Loaded on first use and kept while the background script is alive.
  let dictionary: Promise<Dictionary> | null = null;
  const loadDictionary = () =>
    (dictionary ??= fetch(browser.runtime.getURL('/dict/en_UK.json')).then((r) => r.json()));

  async function handleLookup(word: string): Promise<LookupResult> {
    if (!(await isPaid())) return { status: 'not_paid' };
    const match = lookup(await loadDictionary(), word);
    return match ? { status: 'ok', ...match } : { status: 'not_found' };
  }

  function handle(message: Message): Promise<unknown> | undefined {
    switch (message.type) {
      case 'LOOKUP':
        return handleLookup(message.word);
      case 'GET_LICENSE':
        return getLicenseStatus();
      case 'ACTIVATE':
        return activate(message.key);
      case 'DEACTIVATE':
        return deactivate();
      case 'RECOVER':
        return recover(message.email);
    }
  }

  // sendResponse + `return true` rather than returning a Promise: Chrome doesn't support promise replies everywhere.
  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    const reply = handle(message);
    if (!reply) return false;
    reply.then(sendResponse, (err) => sendResponse({ error: String(err) }));
    return true;
  });
});
