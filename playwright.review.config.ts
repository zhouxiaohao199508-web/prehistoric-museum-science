import { defineConfig, devices } from '@playwright/test'

const reviewPort = 4174

export default defineConfig({
  testDir: './review-e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 120_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${reviewPort}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run review -- --host 127.0.0.1 --port ${reviewPort}`,
    reuseExistingServer: true,
    timeout: 120_000,
    url: `http://127.0.0.1:${reviewPort}`,
  },
})
