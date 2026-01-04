import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',

  // Run tests in parallel with sharding support
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    isCI ? ['github'] : ['list'],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    // Setup: create test user and session
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // Teardown: cleanup test data
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
    },

    // Chromium (primary - supports WebAuthn virtual authenticator)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // See: https://playwright.dev/docs/auth#core-concepts
        // authentication routine will store the browser state here, so tests start authenticated.
        storageState: '.auth/auth.json',
      },
      dependencies: ['setup'],
      teardown: 'teardown',
    },

    // Firefox - runs after Chromium since they share the same test repos
    // (repoSettings is keyed by owner/repo, not by user)
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: '.auth/auth-firefox.json',
      },
      dependencies: ['setup', 'chromium'],
      teardown: 'teardown',
    },
  ],

  // Start dev server for local testing
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120000,
  },
});
