import { buildError, sanitizeErrorMessage, toOptionalString, type CanonicalError } from './error'

export type HttpError = CanonicalError & {
  status: number
}

export type ToHttpErrorOptions = {
  fallbackCode?: string
  fallbackMessage?: string
  fallbackStatus?: number
  requestId?: string
}

type ErrorLike = {
  code?: unknown
  message?: unknown
  details?: unknown
  requestId?: unknown
  status?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readErrorLike(value: unknown): ErrorLike | null {
  return isObject(value) ? (value as ErrorLike) : null
}

function readStatus(value: unknown, fallbackStatus: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallbackStatus
}

export function toHttpError(error: unknown, options: ToHttpErrorOptions = {}): HttpError {
  const fallbackCode = options.fallbackCode ?? 'internal_error'
  const fallbackMessage = options.fallbackMessage ?? 'Internal Server Error'
  const fallbackStatus = options.fallbackStatus ?? 500

  if (error instanceof Error) {
    const errorLike = error as Error & ErrorLike
    return {
      ...buildError(
        typeof errorLike.code === 'string' ? errorLike.code : fallbackCode,
        sanitizeErrorMessage(errorLike.message || fallbackMessage, fallbackMessage),
        toOptionalString(errorLike.details),
        typeof errorLike.requestId === 'string' ? errorLike.requestId : options.requestId,
      ),
      status: readStatus(errorLike.status, fallbackStatus),
    }
  }

  if (typeof error === 'string') {
    return {
      ...buildError(fallbackCode, sanitizeErrorMessage(error, fallbackMessage), undefined, options.requestId),
      status: fallbackStatus,
    }
  }

  const errorLike = readErrorLike(error)
  if (errorLike) {
    return {
      ...buildError(
        typeof errorLike.code === 'string' ? errorLike.code : fallbackCode,
        sanitizeErrorMessage(typeof errorLike.message === 'string' ? errorLike.message : fallbackMessage, fallbackMessage),
        toOptionalString(errorLike.details),
        typeof errorLike.requestId === 'string' ? errorLike.requestId : options.requestId,
      ),
      status: readStatus(errorLike.status, fallbackStatus),
    }
  }

  return {
    ...buildError(fallbackCode, fallbackMessage, undefined, options.requestId),
    status: fallbackStatus,
  }
}
