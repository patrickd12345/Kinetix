import { expect, test } from '@playwright/test'

test.describe('AI chat smoke', () => {
  test('/api/ai-chat returns 200 and text body', async ({ request }) => {
    const res = await request.post('/api/ai-chat', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        systemInstruction: 'You are a running coach. Reply in one short sentence.',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      },
    })
    const raw = await res.text()
    expect(res.status(), raw).toBe(200)
    const body = JSON.parse(raw) as { text?: string }
    expect(body.text?.trim().length ?? 0).toBeGreaterThan(0)
  })

  test('chat page can send Hello when session exists', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    const loginGate = page.getByText('Sign in or create an account to continue.')
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
