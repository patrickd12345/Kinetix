export type StripeLedgerStatus = 'claimed' | 'processed' | 'failed'

export type CanonicalStripeLedgerRecord = {
  event_id: string
  event_type: string
  received_at: string
  processed_at: string | null
  status: StripeLedgerStatus
  error: string | null
  product: string
  account_scope: string
}

export type StripeLedgerClaimRecord = CanonicalStripeLedgerRecord & {
  status: 'claimed'
  processed_at: null
  error: null
}

export type StripeLedgerProcessedUpdate = Pick<
  CanonicalStripeLedgerRecord,
  'processed_at' | 'status' | 'error'
> & {
  status: 'processed'
  error: null
}

export type StripeLedgerFailedUpdate = Pick<
  CanonicalStripeLedgerRecord,
  'processed_at' | 'status' | 'error'
> & {
  status: 'failed'
}
