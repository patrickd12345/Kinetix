/**
 * @bookiji-inc/platform-auth — shared platform auth for Bookiji Inc apps.
 * Spine: admlog (one-shot admin dev login) is the only common-trunk dev login.
 */

export {
  ADMLOG_EMAIL,
  isAdmlogEnabled,
  isAdmlogProductionEnvironment,
  getAdmlogProductionBlockReason,
  getAdmlogBlockReason,
  performAdmlogSignIn,
  type AdmlogBlockReason,
  type AdmlogTokens,
} from './admlog'
