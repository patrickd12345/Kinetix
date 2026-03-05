import { expect, test } from '@playwright/test'

test.describe('web shell and run dashboard', () => {
  test('desktop shell shows dashboard and primary nav', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start run' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible()
  })

  test('mobile shell shows bottom navigation labels', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Run' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible()
  })
})

