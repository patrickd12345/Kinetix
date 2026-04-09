import { expect, test, type Page } from '@playwright/test'

/** SPA routes from `src/App.tsx` (pathname only; query strings allowed). */
const ROUTES_TO_CRAWL = [
  '/',
  '/history',
  '/weight-history',
  '/menu',
  '/chat',
  '/settings',
  '/help',
  '/operator',
  '/support-queue',
] as const

const ALLOWED_PATHS = new Set<string>([
  '/',
  '/history',
  '/weight-history',
  '/menu',
  '/chat',
  '/settings',
  '/help',
  '/operator',
  '/support-queue',
  '/login',
  '/billing/success',
  '/billing/cancel',
])

function pathnameOfHref(href: string): string | null {
  const t = href.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  const noHash = t.split('#')[0] ?? t
  const noQuery = noHash.split('?')[0] ?? noHash
  return noQuery || '/'
}

async function collectInternalHrefs(page: Page): Promise<string[]> {
  return page.$$eval('a[href]', (anchors) =>
    anchors
      .map((a) => a.getAttribute('href'))
      .filter((h): h is string => typeof h === 'string' && h.length > 0),
  )
}

test.describe('internal link crawl (SPA)', () => {
  for (const route of ROUTES_TO_CRAWL) {
    test(`no disallowed same-origin paths from ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      const hrefs = await collectInternalHrefs(page)
      const bad: string[] = []
      for (const h of hrefs) {
        const p = pathnameOfHref(h)
        if (p == null) continue
        if (!ALLOWED_PATHS.has(p)) {
          bad.push(h)
        }
      }
      expect(bad, `Unexpected internal hrefs on ${route}: ${bad.join(', ')}`).toEqual([])
    })
  }

  test('primary nav links resolve without 404 shell', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    for (const label of ['History', 'Help', 'Settings'] as const) {
      const link = page.getByRole('link', { name: label }).first()
      await expect(link).toBeVisible()
      await link.click()
      await expect(page).not.toHaveURL(/\/login\b/)
      await page.goBack()
    }
  })
})
