import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** All pathname routes from `src/App.tsx` (protected + public shells). */
const ALL_ROUTES = [
  '/',
  '/history',
  '/coaching',
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
] as const

function routeToSlug(route: string) {
  if (route === '/') return 'home'
  return route.replace(/^\//, '').replace(/\//g, '_') || 'home'
}

async function attachConsoleCapture(page: Page, testSlug: string) {
  const lines: string[] = []
  const onConsole = (msg: ConsoleMessage) => {
    const t = msg.type()
    if (t === 'error' || t === 'warning') {
      lines.push(`[${t}] ${msg.text()}`)
    }
  }
  const onPageError = (err: Error) => {
    lines.push(`[pageerror] ${err.message}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  return {
    lines,
    detach: () => {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
    },
    dump: async (attach: (name: string, body: Buffer) => Promise<void>) => {
      if (lines.length > 0) {
        await attach(`console-${testSlug}.txt`, Buffer.from(lines.join('\n'), 'utf8'))
      }
    },
  }
}

test.describe('Kinetix audit crawl', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  for (const route of ALL_ROUTES) {
    test(`route ${route || '/'} — load, axe, screenshot`, async ({ page }, testInfo) => {
      const s = routeToSlug(route)
      const cap = await attachConsoleCapture(page, s)

      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(300)

      await page.screenshot({
        path: testInfo.outputPath(`audit-${s}.png`),
        fullPage: true,
      })

      const axe = await new AxeBuilder({ page }).analyze()
      const axeSummary = {
        url: page.url(),
        violationCount: axe.violations.length,
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          help: v.help,
        })),
        incompleteCount: axe.incomplete.length,
      }

      await testInfo.attach(`axe-${s}.json`, {
        body: Buffer.from(JSON.stringify(axeSummary, null, 2)),
        contentType: 'application/json',
      })

      await cap.dump(async (name, body) => {
        await testInfo.attach(name, { body, contentType: 'text/plain' })
      })
      cap.detach()
    })
  }

  test('primary navigation visits every shell route without login redirect', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const nav = page.getByRole('navigation', { name: 'Primary navigation' })
    const labels = [
      'Run',
      'History',
      'Coaching',
      'Weight',
      'Charts',
      'Chat',
      'Help',
      'Operator',
      'Queue',
      'Settings',
    ] as const
    for (const label of labels) {
      const link = nav.getByRole('link', { name: label, exact: true })
      await expect(link).toBeVisible()
      await link.click()
      await expect(page).not.toHaveURL(/\/login\b/)
    }
  })
})
