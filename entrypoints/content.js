import { init } from '../lib/main.js';

export default defineContentScript({
  matches: [
    'https://www.instagram.com/*',
    'https://instagram.com/*',
  ],
  runAt: 'document_idle',
  allFrames: false,

  main() {
    // 注入 storage area，lib/ 才不相依 chrome API
    init({ storageArea: chrome.storage.sync });
  },
});
