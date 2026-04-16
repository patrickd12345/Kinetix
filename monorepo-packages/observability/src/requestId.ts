export type RequestIdSource =
  | string
  | Headers
  | Request
  | Record<string, string | string[] | undefined>
  | null
  | undefined

function readHeaderMapValue(source: Record<string, string | string[] | undefined>): string | undefined {
  const candidates = [
    source['x-request-id'],
    source['X-Request-Id'],
    source['X-Request-ID'],
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (Array.isArray(value)) {
      const match = value.find((item) => typeof item === 'string' && item.trim())
      if (match) {
        return match.trim()
      }
    }
  }

  return undefined
}

function isHeaderMap(source: RequestIdSource): source is Record<string, string | string[] | undefined> {
  return (
    !!source &&
    typeof source === 'object' &&
    !(typeof Headers !== 'undefined' && source instanceof Headers) &&
    !(typeof Request !== 'undefined' && source instanceof Request)
  )
}

export function getRequestId(source?: RequestIdSource): string {
  if (typeof source === 'string' && source.trim()) {
    return source.trim()
  }

  if (typeof Headers !== 'undefined' && source instanceof Headers) {
    const existing = source.get('x-request-id')?.trim()
    return existing || crypto.randomUUID()
  }

  if (typeof Request !== 'undefined' && source instanceof Request) {
    const existing = source.headers.get('x-request-id')?.trim()
    return existing || crypto.randomUUID()
  }

  if (isHeaderMap(source)) {
    const existing = readHeaderMapValue(source)
    return existing || crypto.randomUUID()
  }

  return crypto.randomUUID()
}
