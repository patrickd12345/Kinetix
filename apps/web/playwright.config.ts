import { defineConfig, devices } from '@playwright/test'

const liveGoogleProof = process.env.LIVE_GOOGLE_PROOF === '1'
const baseURL = process.env.PW_BASE_URL ?? (liveGoogleProof ? 'https://kinetix.bookiji.com' : 'http://127.0.0.1:5173')
const video = process.env.PW_VIDEO === '1' || liveGoogleProof ? 'on' : 'off'

const config = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL,
    video,
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL ?? 'chrome',
        ...(liveGoogleProof
          ? {
              launchOptions: {
                args: ['--disable-blink-features=AutomationControlled'],
                ignoreDefaultArgs: ['--enable-automation'],
              },
            }
          : {}),
      },
    },
  ],
  ...(liveGoogleProof
    ? {}
    : {
        webServer: {
          /** Default `vite.config.ts` has no `vite-plugin-oauth`. Build `@kinetix/core` so `ragClient` resolves. */
          command: 'pnpm --filter @kinetix/core build && pnpm exec vite --host 127.0.0.1 --port 5173',
          url: 'http://127.0.0.1:5173',
          // Reusing a manually started Vite dev server can drop `VITE_SKIP_AUTH` from webServer.env and stall auth in tests.
          reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_SKIP_AUTH: process.env.VITE_SKIP_AUTH ?? '1',
            VITE_AUTH_GOOGLE_ENABLED: 'true',
            /** Enables entitlement bypass + all feature flags for full UI audit (see `src/lib/debug/masterAccess.ts`). */
            VITE_MASTER_ACCESS: process.env.VITE_MASTER_ACCESS ?? '1',
            // Stable RAG base for E2E KB mocks; Playwright stubs support/kb/query — no real service on this port.
            VITE_RAG_SERVICE_URL: process.env.VITE_RAG_SERVICE_URL ?? 'http://127.0.0.1:13001',
          },
        },
      }),
})

export default config
