export const REQUEST_ID_HEADER = 'x-request-id'

export type RequestIdSource = string | Headers | Request | null | undefined

function isHeadersLike(value: unknown): value is Pick<Headers, 'get'> {
  return typeof value === 'object' && value !== null && 'get' in value && typeof (value as { get?: unknown }).get === 'function'
}

function readRequestId(source: RequestIdSource): string | undefined {
  if (typeof source === 'string') {
    const normalized = source.trim()
    return normalized || undefined
  }

  if (typeof Request !== 'undefined' && source instanceof Request) {
    return readRequestId(source.headers)
  }

  if (typeof Headers !== 'undefined' && source instanceof Headers) {
    const value = source.get(REQUEST_ID_HEADER)?.trim()
    return value || undefined
  }

  if (isHeadersLike(source)) {
    const value = source.get(REQUEST_ID_HEADER)
    if (typeof value === 'string') {
      const normalized = value.trim()
      return normalized || undefined
    }
  }

  return undefined
}

export function getOrCreateRequestId(source?: RequestIdSource): string {
  return readRequestId(source) ?? crypto.randomUUID()
}
