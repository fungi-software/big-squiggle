import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
  test: {
    // the browser tests are Playwright's, run by `npm run test:e2e`
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
