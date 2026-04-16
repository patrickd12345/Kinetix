import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Settings interactions', () => {
  test('toggles Physio-Pacer Mode and changes unit system', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 20_000 })

    const physio = page.getByRole('button', { name: 'Toggle Physio-Pacer Mode' })
    const before = await physio.getAttribute('aria-pressed')
    await physio.click()
    const after = await physio.getAttribute('aria-pressed')
    expect(before).not.toBe(after)

    const unitSelect = page.locator('select').filter({ has: page.locator('option[value="imperial"]') }).first()
    await unitSelect.selectOption('imperial')
    await expect(unitSelect).toHaveValue('imperial')
    await unitSelect.selectOption('metric')
    await expect(unitSelect).toHaveValue('metric')
  })
})
