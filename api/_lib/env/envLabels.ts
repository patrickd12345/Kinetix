export function resolveEnvironmentLabelFromRaw(raw?: string) {
  const normalized = (raw || '').trim().toLowerCase()
  if (normalized === 'production' || normalized === 'prod') return 'PROD'
  if (normalized === 'preview' || normalized === 'staging' || normalized === 'stage') return 'STAGING'
  if (normalized === 'development' || normalized === 'dev' || normalized === 'test' || normalized === 'local') return 'DEV'
  return 'UNKNOWN'
}
