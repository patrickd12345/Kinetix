import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('web shell and run dashboard', () => {
  test('desktop shell shows dashboard and primary nav', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Start run' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' }).first()).toBeVisible()
  })

  test('tablet width shows sidebar primary nav without duplicating links in the header', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible({ timeout: 20_000 })
    await page.setViewportSize({ width: 900, height: 800 })

    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
    await expect(page.locator('header nav')).toHaveCount(0)
    await expect(page.getByTestId('shell-nav-active')).toBeVisible()

    const activeStyles = await page.getByTestId('shell-nav-active').evaluate((element) => {
      const styles = window.getComputedStyle(element)
      return { color: styles.color, background: styles.backgroundColor, border: styles.borderColor }
    })
    expect(activeStyles.color).not.toBe(activeStyles.background)
    expect(activeStyles.border).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('skip link receives focus when tabbing from the address bar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('#main-content')).toBeAttached()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveCSS('outline-style', 'solid')
  })

  test('mobile shell shows trimmed bottom navigation with overflow routes under More', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: 'Run' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'History' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Coaching' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chat' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Help' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'More navigation options' })).toBeVisible()
    await expect(page.getByTestId('shell-nav-active-mobile')).toBeVisible()

    await page.getByRole('button', { name: 'More navigation options' }).click()
    await expect(page.getByRole('navigation', { name: 'More navigation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(page.getByTestId('shell-nav-active-mobile-overflow')).toBeVisible()
  })

  test('shell passes axe in light and dark themes', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Run Dashboard' })).toBeVisible({ timeout: 20_000 })

    const lightAxe = await new AxeBuilder({ page }).analyze()
    expect(lightAxe.violations).toEqual([])

    await page.getByRole('button', { name: 'Dark theme' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.waitForTimeout(250)

    const darkAxe = await new AxeBuilder({ page }).analyze()
    expect(darkAxe.violations).toEqual([])
  })
})
