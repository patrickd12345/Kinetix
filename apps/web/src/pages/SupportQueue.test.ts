import { describe, expect, it } from 'vitest'
import { sanitizeMarkdownLinkHref } from '../lib/sanitizeMarkdownLinkHref'

describe('sanitizeMarkdownLinkHref', () => {
  it.each([
    ['https://example.com/help', 'https://example.com/help'],
    ['http://example.com/help', 'http://example.com/help'],
    ['mailto:support@example.com', 'mailto:support@example.com'],
    ['javascript:alert(1)', null],
    ['javascript://%250Aalert(1)', null],
    ['data:text/html;base64,PHNjcmlwdA==', null],
    ['vbscript:msgbox("hello")', null],
    ['/relative/path', null],
    ['https://example.com/\nmalformed', null],
    ['  javascript:alert(1)  ', null],
  ])('sanitizes %s', (input, expected) => {
    expect(sanitizeMarkdownLinkHref(input)).toBe(expected)
  })
})
