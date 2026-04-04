import {
  getAdmlogBlockReason as getSharedAdmlogBlockReason,
  isAdmlogEnabled as isSharedAdmlogEnabled,
  isAdmlogProductionEnvironment as isSharedAdmlogProductionEnvironment,
  performAdmlogSignIn as performSharedAdmlogSignIn,
} from '@bookiji-inc/platform-auth'

export const isAdmlogEnabled = isSharedAdmlogEnabled
export const getAdmlogBlockReason = getSharedAdmlogBlockReason
export const isAdmlogProductionEnvironment = isSharedAdmlogProductionEnvironment
export const performAdmlogSignIn = performSharedAdmlogSignIn
