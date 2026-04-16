import { expect, test } from '@playwright/test'

test.describe('AI chat smoke', () => {
  test('/api/ai-chat handler runs (no platform crash; optional AI env for 200)', async ({ request }) => {
    const res = await request.post('/api/ai-chat', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        systemInstruction: 'You are a running coach. Reply in one short sentence.',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      },
    })
    const raw = await res.text()
    expect(raw, 'Vercel should not return FUNCTION_INVOCATION_FAILED once modules resolve').not.toMatch(
      /FUNCTION_INVOCATION_FAILED/,
    )
    if (res.status() === 200) {
      const body = JSON.parse(raw) as { text?: string }
      expect(body.text?.trim().length ?? 0).toBeGreaterThan(0)
      return
    }
    if (res.status() === 404) {
      // Local Playwright `vite` dev server does not mount Vercel `api/*` routes; production validates the handler.
      expect(raw).not.toMatch(/FUNCTION_INVOCATION_FAILED/)
      return
    }
    expect(res.status(), raw).toBe(502)
    const errBody = JSON.parse(raw) as { code?: string }
    expect(errBody.code).toBe('ai_execution_failed')
  })

  test('chat page can send Hello when session exists', async ({ page }) => {
    test.setTimeout(150_000)
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    const loginGate = page.getByRole('button', { name: 'Send magic link' })
    if (await loginGate.isVisible().catch(() => false)) {
      test.skip(true, 'Chat UI needs a signed-in session; the API case above validates /api/ai-chat after deploy.')
      return
    }
    await expect(page.getByRole('heading', { name: 'Coach chat' })).toBeVisible()
    await page.getByPlaceholder('Message the coach…').fill('Hello')
    await page.locator('form button[type="submit"]').click()
    await expect(page.getByText('Hello', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Thinking…')).toBeHidden({ timeout: 120_000 })
  })
})
