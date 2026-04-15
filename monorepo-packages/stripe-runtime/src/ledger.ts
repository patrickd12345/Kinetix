import type {
  StripeLedgerClaimRecord,
  StripeLedgerFailedUpdate,
  StripeLedgerProcessedUpdate,
} from './types'

type BuildStripeLedgerClaimOptions = {
  eventId: string
  eventType: string
  product: string
  accountScope: string
  receivedAt?: Date | string
}

type ClaimStripeEventOptions<TError> = BuildStripeLedgerClaimOptions & {
  insertClaim: (claim: StripeLedgerClaimRecord) => Promise<{ error: TError | null }>
  isDuplicateError?: (error: TError) => boolean
}

export function buildStripeLedgerClaim(options: BuildStripeLedgerClaimOptions): StripeLedgerClaimRecord {
  return {
    event_id: options.eventId,
    event_type: options.eventType,
    received_at:
      options.receivedAt instanceof Date
        ? options.receivedAt.toISOString()
        : options.receivedAt ?? new Date().toISOString(),
    processed_at: null,
    status: 'claimed',
    error: null,
    product: options.product,
    account_scope: options.accountScope,
  }
}

export function buildStripeProcessedUpdate(processedAt: Date | string = new Date()): StripeLedgerProcessedUpdate {
  return {
    processed_at: processedAt instanceof Date ? processedAt.toISOString() : processedAt,
    status: 'processed',
    error: null,
  }
}

export function buildStripeFailedUpdate(
  errorMessage: string,
  processedAt: Date | string = new Date(),
): StripeLedgerFailedUpdate {
  return {
    processed_at: processedAt instanceof Date ? processedAt.toISOString() : processedAt,
    status: 'failed',
    error: errorMessage,
  }
}

export function isStripeDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const maybeError = error as { code?: unknown; constraint?: unknown; message?: unknown }
  const code = typeof maybeError.code === 'string' ? maybeError.code : ''
  const constraint = typeof maybeError.constraint === 'string' ? maybeError.constraint : ''
  const message = typeof maybeError.message === 'string' ? maybeError.message : ''

  return (
    code === '23505' ||
    constraint.toLowerCase().includes('event_id') ||
    message.toLowerCase().includes('duplicate')
  )
}

export async function claimStripeEvent<TError = unknown>(
  options: ClaimStripeEventOptions<TError>,
): Promise<{
  claim: StripeLedgerClaimRecord
  claimed: boolean
  duplicate: boolean
  error: TError | null
}> {
  const claim = buildStripeLedgerClaim(options)
  const result = await options.insertClaim(claim)
  const error = result.error

  if (!error) {
    return { claim, claimed: true, duplicate: false, error: null }
  }

  const duplicate = options.isDuplicateError ? options.isDuplicateError(error) : isStripeDuplicateError(error)
  return {
    claim,
    claimed: false,
    duplicate,
    error,
  }
}
