import { init } from '../lib/main.js';

export default defineContentScript({
  matches: [
    'https://www.instagram.com/*',
    'https://instagram.com/*',
  ],
  runAt: 'document_idle',
  allFrames: false,

  main() {
    // 把 storage area 注入進去，lib/ 才不用直接相依 chrome API（測試也好替換）
    init({ storageArea: chrome.storage.sync });
  },
});
