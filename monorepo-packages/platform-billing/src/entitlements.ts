import type { Entitlement } from "./types";

export const directEntitlements: Set<Entitlement> = new Set([
  "kinetix_pro",
  "myassist_pro",
  "mychesscoach_pro",
]);

export const bundleDerivedEntitlements: Set<Entitlement> = new Set([
  "bookiji_one",
]);

export function isBundleGranting(entitlement: Entitlement): boolean {
  return bundleDerivedEntitlements.has(entitlement);
}

export function isProductUnlocked(
  productEntitlement: Entitlement,
  effectiveEntitlements: Set<Entitlement> | Entitlement[]
): boolean {
  const entitlements =
    effectiveEntitlements instanceof Set
      ? effectiveEntitlements
      : new Set(effectiveEntitlements);

  return entitlements.has(productEntitlement);
}
