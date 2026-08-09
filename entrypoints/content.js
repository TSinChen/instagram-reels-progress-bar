import { init } from '../lib/main.js';

export default defineContentScript({
  matches: [
    'https://www.instagram.com/*',
    'https://instagram.com/*',
  ],
  runAt: 'document_idle',
  allFrames: false,

  main() {
    init();
  },
});
