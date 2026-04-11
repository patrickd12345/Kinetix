import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /** Default `vite.config.ts` has no `vite-plugin-oauth`. Build `@kinetix/core` so `ragClient` resolves. */
    command: 'pnpm --filter @kinetix/core build && pnpm exec vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    // Reusing a manually started Vite dev server can drop `VITE_SKIP_AUTH` from webServer.env and stall auth in tests.
    reuseExistingServer: process.env.PW_REUSE_SERVER === '1',
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_SKIP_AUTH: '1',
      /** Enables entitlement bypass + all feature flags for full UI audit (see `src/lib/debug/masterAccess.ts`). */
      VITE_MASTER_ACCESS: '1',
    },
  },
})
