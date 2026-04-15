import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { applyResolvedTheme, getResolvedTheme } from './themeStore'

describe('themeStore helpers', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getResolvedTheme returns light or dark for fixed preferences', () => {
    expect(getResolvedTheme('light')).toBe('light')
    expect(getResolvedTheme('dark')).toBe('dark')
  })

  it('getResolvedTheme uses matchMedia when system', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const isDark = query === '(prefers-color-scheme: dark)'
      return {
        matches: isDark,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      } as unknown as MediaQueryList
    })
    expect(getResolvedTheme('system')).toBe('dark')

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const isDark = query === '(prefers-color-scheme: dark)'
      return {
        matches: !isDark,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      } as unknown as MediaQueryList
    })
    expect(getResolvedTheme('system')).toBe('light')
  })

  it('applyResolvedTheme toggles dark class on documentElement', () => {
    applyResolvedTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    applyResolvedTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
