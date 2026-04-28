import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

/**
 * The default Playwright webServer runs with `VITE_SKIP_AUTH=1`, which auto-authenticates
 * the bypass profile and redirects `/login` away before the OAuth UI ever renders. To
 * exercise the actual Google OAuth UI we need the dev server started with
 * `VITE_SKIP_AUTH=0`. This test skips itself in the default flow rather than failing the
 * suite; CI/operator runbooks (`PHASE4_INTERACTIVE_RUNBOOK.md`) re-run it with the env
 * override when validating SSO end-to-end.
 */
const skipAuthEnabled = (process.env.VITE_SKIP_AUTH ?? '1') !== '0'

/** Standalone `test.skip(condition)` before `test()` does not reliably skip the next test in all Playwright versions; use conditional describe.skip. */
;(skipAuthEnabled ? test.describe.skip : test.describe)(
  'google oauth login',
  () => {
  test('login page starts a Google OAuth redirect with the expected provider and return path', async ({ page }) => {
    let oauthAuthorizeUrl: string | null = null

    await page.route('**/auth/v1/authorize**', async (route) => {
      oauthAuthorizeUrl = route.request().url()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth' }),
      })
    })

    await page.goto('/login?next=/history')

    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    await page.getByRole('button', { name: 'Continue with Google' }).click()

    await expect.poll(() => oauthAuthorizeUrl).not.toBeNull()

    const capturedUrl = new URL(oauthAuthorizeUrl ?? '')
    expect(capturedUrl.searchParams.get('provider')).toBe('google')
    expect(capturedUrl.searchParams.get('redirect_to')).toContain('/login?next=%2Fhistory')

    await expect(page).toHaveURL(/accounts\.google\.com\/o\/oauth2\/v2\/auth/)
  })
})
