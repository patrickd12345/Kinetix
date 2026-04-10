import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

async function expectVisibleKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused()
  await expect(locator).toHaveCSS('outline-style', 'solid')
}

test.describe('Help Center shell readability', () => {
  test('shows Help Center headings and support search field with keyboard-reachable controls', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: 'Help Center', level: 1 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Support search (AI + KB)' })).toBeVisible()

    const search = page.locator('#help-support-search')
    await expect(search).toBeVisible()
    await search.fill('sync')
    await expect(page.getByRole('button', { name: 'Search' })).toBeEnabled()
    await search.focus()
    await expect(search).toBeFocused()

    await page.keyboard.press('Tab')
    await expectVisibleKeyboardFocus(page.getByRole('button', { name: 'Search' }))
  })

  test('passes axe and contrast-sensitive checks in light and dark themes', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: 'Help Center', level: 1 })).toBeVisible({ timeout: 20_000 })

    const lightAxe = await new AxeBuilder({ page }).analyze()
    expect(lightAxe.violations).toEqual([])

    const search = page.locator('#help-support-search')
    const searchStyles = await search.evaluate((element) => {
      const styles = window.getComputedStyle(element)
      return {
        color: styles.color,
        background: styles.backgroundColor,
      }
    })
    expect(searchStyles.color).not.toBe(searchStyles.background)

    await search.fill('')
    const disabledSearch = page.getByRole('button', { name: 'Search' })
    await expect(disabledSearch).toBeDisabled()
    const disabledStyles = await disabledSearch.evaluate((element) => {
      const styles = window.getComputedStyle(element)
      return {
        color: styles.color,
        background: styles.backgroundColor,
        border: styles.borderColor,
      }
    })
    expect(disabledStyles.color).not.toBe(disabledStyles.background)
    expect(disabledStyles.border).not.toBe('rgba(0, 0, 0, 0)')

    await search.focus()
    await expectVisibleKeyboardFocus(search)

    await page.getByRole('button', { name: 'Dark theme' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.waitForTimeout(250)

    const darkAxe = await new AxeBuilder({ page }).analyze()
    expect(darkAxe.violations).toEqual([])

    await search.fill('sync')
    await search.focus()
    await page.keyboard.press('Tab')
    await expectVisibleKeyboardFocus(page.getByRole('button', { name: 'Search' }))
  })
})
