function containsAsciiControlsOrDel(href: string): boolean {
  for (let i = 0; i < href.length; i += 1) {
    const code = href.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

function containsWhitespace(href: string): boolean {
  return /\s/u.test(href)
}

export function sanitizeMarkdownLinkHref(href: string | null | undefined): string | null {
  const trimmed = href?.trim()
  if (!trimmed) return null
  if (containsAsciiControlsOrDel(trimmed) || containsWhitespace(trimmed)) return null
  if (trimmed.toLowerCase().startsWith('mailto:')) return trimmed
  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') return trimmed
  } catch {
    return null
  }
  return null
}
