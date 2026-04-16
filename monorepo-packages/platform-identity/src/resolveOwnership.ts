import { IdentityContext, OwnershipResult } from './types.js'

export function resolveOwnership(context: IdentityContext): OwnershipResult {
  const result: OwnershipResult = {
    kinetix: false,
    myassist: false,
    mychesscoach: false,
    bookiji: false,
  }

  // 1. Resolve Spine Billing Entitlements
  // The entitlements array from platform-billing provides flattened unlocks.
  // We check if the entitlement matches the product key directly (or a variant like _pro)
  if (context.entitlements && Array.isArray(context.entitlements)) {
    for (const entitlement of context.entitlements) {
      if (entitlement.startsWith('kinetix')) {
        result.kinetix = true
      }
      if (entitlement.startsWith('myassist')) {
        result.myassist = true
      }
      if (entitlement.startsWith('mychesscoach')) {
        result.mychesscoach = true
      }
      // Note: Bookiji is excluded from Spine billing
    }
  }

  // 2. Resolve External Bookiji Ownership (and overrides)
  // External ownership doesn't rely on Spine billing and allows injecting status
  // for any product, but is primarily meant for Bookiji
  if (context.externalOwnership) {
    if (context.externalOwnership.kinetix !== undefined) {
      result.kinetix = context.externalOwnership.kinetix
    }
    if (context.externalOwnership.myassist !== undefined) {
      result.myassist = context.externalOwnership.myassist
    }
    if (context.externalOwnership.mychesscoach !== undefined) {
      result.mychesscoach = context.externalOwnership.mychesscoach
    }
    if (context.externalOwnership.bookiji !== undefined) {
      result.bookiji = context.externalOwnership.bookiji
    }
  }

  return result
}
