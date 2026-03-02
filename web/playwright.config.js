import { defineConfig } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT || 4173
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`
const enableE2E = process.env.PLAYWRIGHT_E2E === '1'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL,
    headless: true
  },
  webServer: enableE2E
    ? {
        command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        stdout: 'ignore',
        stderr: 'pipe'
      }
    : undefined
})
