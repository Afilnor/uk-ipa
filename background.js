chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_IPA") {
    (async () => {
      try {
        const response = await fetch(`https://dictionary.cambridge.org/dictionary/english/${message.word}`);
        const html = await response.text();
        sendResponse({ error: false, content: html });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })(); // Immediately-invoked async function
    return true; // Required to keep the message channel open
  }
});