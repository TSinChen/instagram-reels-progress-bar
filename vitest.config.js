import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // WxtVitest 會把擴充功能 API 換成記憶體內的實作（fakeBrowser），
  // 這樣 lib/settings.js 之類會碰 storage 的模組可以直接測，不用自己 mock。
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
