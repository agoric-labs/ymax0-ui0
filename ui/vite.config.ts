/// <reference types="vitest" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    testTimeout: 20000, // 20 seconds for puppeteer CI
    // modified import('vitest/dist/config.js').defaultInclude
    include: ['src/**/*.spec.?(c|m)[jt]s?(x)'],
  },
});
