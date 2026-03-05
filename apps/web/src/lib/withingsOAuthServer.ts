/**
 * Canonical Withings OAuth helpers are implemented in api/_lib.
 * Re-exported here so existing tests/scripts in apps/web keep stable imports.
 */
export {
  WITHINGS_API,
  withingsHmac,
  withingsGetNonce,
  withingsRequestToken,
  type WithingsTokenResult,
} from '../../../../api/_lib/withingsAuth'
