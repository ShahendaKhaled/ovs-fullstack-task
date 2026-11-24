// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT ?? 8000);
const baseURL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  // Every test shares one MySQL database and some tests enroll students,
  // so run them one at a time in file order: no test can see another's write mid-run.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries: tests enroll students, so a retry would run against changed data
  // and fail for a different reason than the first attempt.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./tests/global-setup.js'),

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Starts the PHP dev server, or reuses one that is already running locally.
  webServer: {
    command: `php -S 127.0.0.1:${PORT} -t public`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
