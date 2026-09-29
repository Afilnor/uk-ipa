import { browser } from 'wxt/browser';
import { formatIpa } from '@/utils/lookup';
import type { LookupResult, Message } from '@/utils/messages';
import './style.css';

const POPUP_ID = 'uk-ipa-popup';
const POPUP_TIMEOUT_MS = 10_000;

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const removePopup = () => {
      clearTimeout(hideTimer);
      document.getElementById(POPUP_ID)?.remove();
    };

    const showPopup = (text: string, rect: DOMRect) => {
      removePopup();
      const popup = document.createElement('div');
      popup.id = POPUP_ID;
      popup.textContent = text;
      document.body.appendChild(popup);
      popup.style.top = `${window.scrollY + rect.top - popup.offsetHeight - 8}px`;
      popup.style.left = `${window.scrollX + rect.left}px`;
      hideTimer = setTimeout(removePopup, POPUP_TIMEOUT_MS);
    };

    document.addEventListener('mousedown', (event) => {
      const existing = document.getElementById(POPUP_ID);
      if (existing && !existing.contains(event.target as Node)) removePopup();
    });

    document.addEventListener('mouseup', async () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const selectedText = selection.toString().trim();
      if (!selectedText || /\s/.test(selectedText) || selectedText.length > 50) return;

      // Measure now: the selection may change before the lookup answers.
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      let result: LookupResult;
      try {
        result = await browser.runtime.sendMessage({ type: 'LOOKUP', word: selectedText } satisfies Message);
      } catch {
        return; // extension was reloaded or updated; the page needs a refresh
      }

      if (result.status === 'ok') {
        const matchedNote = result.word === selectedText.toLowerCase() ? '' : ` (${result.word})`;
        showPopup(`UK${matchedNote}: ${formatIpa(result.ipa)}`, rect);
      } else if (result.status === 'not_found') {
        showPopup('UK IPA not found', rect);
      } else if (result.status === 'not_paid') {
        showPopup('UK IPA is locked. Click the UK IPA icon in your toolbar to unlock it.', rect);
      }
    });
  },
});
