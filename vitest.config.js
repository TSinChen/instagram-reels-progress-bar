import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // Swaps the extension APIs for in-memory ones, so modules that touch storage need no mock
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
