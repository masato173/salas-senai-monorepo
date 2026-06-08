import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:    './tests/e2e',
  timeout:    30_000,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 1 : undefined,
  reporter:   process.env.CI ? 'github' : 'list',

  use: {
    baseURL:      process.env.BASE_URL ?? 'https://masato173.github.io/salas-senai/',
    screenshot:   'only-on-failure',
    video:        'retain-on-failure',
    trace:        'on-first-retry',
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
  ],
});
