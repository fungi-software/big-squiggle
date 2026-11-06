import { defineConfig } from '@playwright/test';

const PORT = 5174;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // a key makes the app load posthog-js; the host is a name the test intercepts
    env: {
      VITE_POSTHOG_KEY: 'phc_e2e',
      VITE_POSTHOG_HOST: 'https://posthog.e2e.test',
      // under `firebase emulators:exec` a local .env.local must not win over the emulator,
      // and the demo project is the one the emulator was started for
      ...(process.env.FIREBASE_DATABASE_EMULATOR_HOST
        ? {
            VITE_USE_EMULATOR: 'true',
            VITE_FB_API_KEY: 'demo-key',
            VITE_FB_AUTH_DOMAIN: 'demo-big-squiggle.firebaseapp.com',
            VITE_FB_DATABASE_URL: 'https://demo-big-squiggle-default-rtdb.firebaseio.com',
            VITE_FB_PROJECT_ID: 'demo-big-squiggle',
            VITE_FB_APP_ID: '1:0:web:0',
          }
        : {}),
    },
  },
});
