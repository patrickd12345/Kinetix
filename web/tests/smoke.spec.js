import { test, expect } from '@playwright/test'

const enableE2E = process.env.PLAYWRIGHT_E2E === '1'

test.describe('e2e smoke', () => {
  test.skip(!enableE2E, 'Set PLAYWRIGHT_E2E=1 and install browsers (npx playwright install chromium)')

  test('home renders core UI', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('KINETIX')).toBeVisible()
    await expect(page.getByText('Start Run')).toBeVisible()
    await expect(page.getByText('History')).toBeVisible()
  })

  test('navigate to settings and back', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-settings').click()
    await expect(page.getByText('SETTINGS')).toBeVisible()
    await page.getByTestId('settings-back').click()
    await expect(page.getByText('KINETIX')).toBeVisible()
  })

  test('start run shows run view', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('home-start-run').click()
    await expect(page.getByTestId('run-status')).toBeVisible()
    await expect(page.getByTestId('run-start')).toBeVisible()
  })
})
