import type { VercelResponse } from '@vercel/node'
import { buildError, type RequestIdSource } from '@bookiji-inc/error-contract'
import { getApiRequestId } from './ai/error-contract'

type HeaderMap = Record<string, string | string[] | undefined>

type ApiErrorSource = RequestIdSource | HeaderMap

export type KinetixHttpError = ReturnType<typeof buildError> & {
  error: string
}

export function sendApiError(
  res: VercelResponse,
  status: number,
  message: string,
  options?: {
    code?: string
    details?: string
    source?: ApiErrorSource
  },
) {
  const requestId = getApiRequestId(options?.source)
  const payload = buildError(
    options?.code ?? inferErrorCode(status),
    message,
    options?.details,
    requestId,
  )
  return res.status(status).json({ error: message, ...payload } satisfies KinetixHttpError)
}

function inferErrorCode(status: number): string {
  if (status === 400) return 'bad_request'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 405) return 'method_not_allowed'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'service_unavailable'
  if (status >= 500) return 'internal_error'
  return 'request_failed'
}
