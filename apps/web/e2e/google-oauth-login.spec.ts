import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('google oauth login', () => {
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
