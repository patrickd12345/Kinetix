import { expect, test } from '@playwright/test'

const liveGoogleProof = process.env.LIVE_GOOGLE_PROOF === '1'
const proofBaseUrl = process.env.PW_BASE_URL ?? 'https://kinetix.bookiji.com'
const proofOrigin = new URL(proofBaseUrl).origin

test.describe.configure({ mode: 'serial' })

test.describe('google oauth live proof', () => {
  test.skip(!liveGoogleProof, 'Set LIVE_GOOGLE_PROOF=1 to run manual live OAuth video proof')

  test('returns to kinetix.bookiji.com after Google auth', async ({ page }) => {
    test.setTimeout(14 * 60 * 1000)

    await page.goto(`${proofOrigin}/login?next=/history`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()

    await page.getByRole('button', { name: 'Continue with Google' }).click()
    await expect(page).toHaveURL(/accounts\.google\.com/, { timeout: 60_000 })

    // Manual step: user types credentials directly in Google-hosted pages.
    await page.waitForURL('https://kinetix.bookiji.com/**', { timeout: 12 * 60 * 1000 })

    const finalUrl = page.url()
    const final = new URL(finalUrl)
    expect(final.origin).toBe('https://kinetix.bookiji.com')
    expect(final.hostname).toBe('kinetix.bookiji.com')
    expect(finalUrl.includes('app.bookiji.com')).toBeFalsy()

    console.log(`[google-live-proof] final_url=${finalUrl}`)
  })
})
