/**
 * Audit-only: when enabled via `VITE_MASTER_ACCESS=1`, entitlement checks pass and
 * feature flags read as fully enabled. Used by Playwright / local full-UI crawls.
 * Never enabled in production builds.
 */
const isProd =
  import.meta.env.MODE === 'production' || import.meta.env.PROD === true

export function assertNoMasterAccessInProd() {
  if (isProd && import.meta.env.VITE_MASTER_ACCESS) {
    throw new Error('MASTER_ACCESS cannot be enabled in production')
  }
}

assertNoMasterAccessInProd()

export const MASTER_ACCESS = !isProd && import.meta.env.VITE_MASTER_ACCESS === '1'
