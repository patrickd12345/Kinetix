import { expect, test } from '@playwright/test'

test.describe('Charts view', () => {
  test('desktop Charts page loads and shows content', async ({ page }) => {
    await page.goto('/menu')

    await expect(page.getByRole('heading', { name: 'Charts' })).toBeVisible()
    await expect(
      page.getByText(/Informative performance charts powered by your run history/i)
    ).toBeVisible()

    // Content: skeleton (loading), chart, empty state, or error
    const skeleton = page.getByTestId('charts-skeleton')
    const chartOrEmpty = page
      .getByTestId('charts-max-kps-pace')
      .or(page.getByTestId('charts-empty-state'))
      .or(page.getByTestId('charts-error'))
    await expect(skeleton.or(chartOrEmpty)).toBeVisible({ timeout: 20_000 })
  })

  test('mobile Charts page loads and shows content', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.goto('/menu')

    await expect(page.getByRole('heading', { name: 'Charts' })).toBeVisible()

    const skeleton = page.getByTestId('charts-skeleton')
    const chartOrEmpty = page
      .getByTestId('charts-max-kps-pace')
      .or(page.getByTestId('charts-empty-state'))
      .or(page.getByTestId('charts-error'))
    await expect(skeleton.or(chartOrEmpty)).toBeVisible({ timeout: 20_000 })
  })
})
