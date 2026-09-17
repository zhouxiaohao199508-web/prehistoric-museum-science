import { defineConfig, devices } from '@playwright/test'

const nestedBase = '/prehistoric-animal-museum/'
const port = 4193

export default defineConfig({
  testDir: './scripts/readme-screenshot-capture',
  fullyParallel: false,
  forbidOnly: true,
  outputDir: '.handoff/readme-screenshots/.playwright',
  reporter: [['list']],
  retries: 0,
  timeout: 60_000,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}${nestedBase}`,
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    deviceScaleFactor: 1,
    locale: 'en-GB',
    screenshot: 'off',
    trace: 'retain-on-failure',
    viewport: { height: 900, width: 1440 },
  },
  webServer: {
    command: `npm run build:readme-screenshots && node server.mjs dist --port ${port} --base ${nestedBase}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}${nestedBase}`,
  },
})
