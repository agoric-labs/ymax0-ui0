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
  // Enable esbuild to transform TypeScript files from @agoric packages
  optimizeDeps: {
    esbuildOptions: {
      // Allow TypeScript files from node_modules
      loader: {
        '.ts': 'ts',
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    testTimeout: 20000, // 20 seconds for puppeteer CI
    // modified import('vitest/dist/config.js').defaultInclude
    include: ['src/**/*.spec.?(c|m)[jt]s?(x)'],
  },
});
