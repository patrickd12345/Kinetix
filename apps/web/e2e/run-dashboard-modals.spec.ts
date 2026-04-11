import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Run dashboard beat modals', () => {
  test('opens BEAT PB modal and closes', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'BEAT PB' }).click()
    await expect(page.locator('#beat-target-modal-title')).toBeVisible()
    await expect(page.locator('#beat-target-modal-title')).not.toHaveText('')
    await page.locator('[role="dialog"] button[aria-label="Close"]').click()
    await expect(page.locator('#beat-target-modal-title')).toHaveCount(0)
  })

  test('opens BEAT RECENTS modal and closes', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'BEAT RECENTS' }).click()
    await expect(page.locator('#beat-target-modal-title')).toBeVisible()
    await page.locator('[role="dialog"] button[aria-label="Close"]').click()
    await expect(page.locator('#beat-target-modal-title')).toHaveCount(0)
  })
})
