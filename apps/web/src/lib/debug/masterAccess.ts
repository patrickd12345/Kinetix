/**
 * Audit-only: when enabled via `VITE_MASTER_ACCESS=1`, entitlement checks pass and
 * feature flags read as fully enabled. Used by Playwright / local full-UI crawls.
 * Default is off in production builds.
 */
export const MASTER_ACCESS =
  import.meta.env.VITE_MASTER_ACCESS === '1' || import.meta.env.VITE_MASTER_ACCESS === 'true'
