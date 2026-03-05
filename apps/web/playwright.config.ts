import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const useExternalServer = Boolean(process.env.BASE_URL)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: 'pnpm dev --host 127.0.0.1 --port 4173',
          cwd: process.cwd(),
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: !process.env.CI,
          env: {
            ...process.env,
            VITE_SKIP_AUTH: '1',
          },
        },
      }),
})

