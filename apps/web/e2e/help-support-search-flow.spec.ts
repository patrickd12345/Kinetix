import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test.describe('Help Center support search flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/support/kb/query', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          collection: 'kinetix_support_kb',
          query: 'sync',
          topK: 5,
          filters: { topic: null },
          results: [
            {
              chunkId: 'e2e-kb-1',
              distance: null,
              similarity: 0.91,
              document: 'E2E curated support excerpt for sync troubleshooting.',
              metadata: { title: 'E2E KB Article', topic: 'sync' },
            },
          ],
        }),
      })
    })

    await page.route('**/api/ai-chat', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'E2E mock support answer (KB-grounded).' }),
      })
    })
  })

  test('runs search and shows assistant answer', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: 'Help Center', level: 1 })).toBeVisible({ timeout: 20_000 })

    await page.locator('#help-support-search').fill('sync issue')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page.getByTestId('help-support-ai-answer')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('help-support-ai-answer')).toContainText('E2E mock support answer')
  })

  test('quick prompt triggers search', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByRole('heading', { name: 'Help Center', level: 1 })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Strava connection' }).click()
    await expect(page.getByTestId('help-support-ai-answer')).toBeVisible({ timeout: 30_000 })
  })
})
