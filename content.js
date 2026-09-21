const popupId = "uk-ipa-popup";

document.addEventListener('mousedown', (event) => {
  const existing = document.getElementById(popupId);
  if (existing && !existing.contains(event.target)) existing.remove();
});

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const selectedText = selection.toString().trim();
  if (!selectedText) return;
  if (/\s/.test(selectedText)) return;

  const existing = document.getElementById(popupId);
  if (existing) existing.remove();

  chrome.runtime.sendMessage({ type: "GET_IPA", word: selectedText.toLocaleLowerCase() }, (response) => {
    if (!response || response.error) {
      console.error(response?.error || "No response from background script");
      return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(response.content, "text/html");
    const parentSpan = doc.querySelector("span.uk.dpron-i");
    const ipa = parentSpan?.querySelector("span.pron.dpron")?.textContent.trim() || "UK IPA not found";
    

    const popup = document.createElement("div");
    popup.id = popupId;
    popup.textContent = `UK: ${ipa}`;
    document.body.appendChild(popup);
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    popup.style.top = `${window.scrollY + rect.top - 40}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;

    setTimeout(() => popup.remove(), 50000);
  });
});