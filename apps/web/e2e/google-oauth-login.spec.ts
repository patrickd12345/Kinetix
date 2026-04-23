import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('google oauth login', () => {
  test('login page starts a Google OAuth redirect with expected provider and next path', async ({
    page,
  }) => {
    await page.goto('/login?next=/history')

    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    const authRequestPromise = page.waitForRequest(/\/auth\/v1\/authorize\?/, { timeout: 15_000 })
    await page.getByRole('button', { name: 'Continue with Google' }).click()

    const authRequest = await authRequestPromise
    const capturedUrl = new URL(authRequest.url())
    expect(capturedUrl.searchParams.get('provider')).toBe('google')

    const redirectTo = capturedUrl.searchParams.get('redirect_to')
    expect(redirectTo).toBeTruthy()
    expect(redirectTo).toContain('/login?next=%2Fhistory')
  })
})
