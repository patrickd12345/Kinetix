import {
  getAdmlogBlockReason as getSharedAdmlogBlockReason,
  isAdmlogEnabled as isSharedAdmlogEnabled,
  performAdmlogSignIn as performSharedAdmlogSignIn,
} from '@bookiji-inc/platform-auth'

export const isAdmlogEnabled = isSharedAdmlogEnabled
export const getAdmlogBlockReason = getSharedAdmlogBlockReason
export const performAdmlogSignIn = performSharedAdmlogSignIn
