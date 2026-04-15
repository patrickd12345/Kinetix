import { describe, it, expect } from 'vitest'
import { buildAdmlogSpaSessionHtml } from './spaHtml'

describe('buildAdmlogSpaSessionHtml', () => {
  it('should not contain innerHTML assignment', () => {
    const html = buildAdmlogSpaSessionHtml({
      session: { access_token: 'abc', refresh_token: 'def' } as any,
      supabaseUrl: 'https://example.supabase.co',
      redirectPath: '/dashboard'
    })

    expect(html).not.toContain('innerHTML')
    expect(html).toContain('document.body.textContent =')
    expect(html).toContain('Could not write session to storage')
  })
})
