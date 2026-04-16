import type {
  UserSubscription,
  AdminPricingOverride,
  EffectiveEntitlementSet,
  EntitlementSource,
  EffectiveEntitlement,
  Entitlement
} from "./types";
import { resolveCatalogWithOverrides, resolveBundlesWithOverrides } from "./adminConfig";
import { isSubscriptionGrantingAccess } from "./subscriptionState";

export function resolveEntitlements(
  subscriptions: UserSubscription[],
  override?: AdminPricingOverride
): EffectiveEntitlementSet {
  const effective: Partial<EffectiveEntitlementSet> = {};
  const catalog = resolveCatalogWithOverrides(override);
  const bundles = resolveBundlesWithOverrides(override);

  const addSource = (entitlement: Entitlement, source: EntitlementSource) => {
    if (!effective[entitlement]) {
      effective[entitlement] = { entitlement, sources: [] };
    }
    // Prevent duplicate sources just in case
    const exists = effective[entitlement]!.sources.some(
      s => s.subscriptionId === source.subscriptionId
    );
    if (!exists) {
      effective[entitlement]!.sources.push(source);
    }
  };

  for (const sub of subscriptions) {
    if (!isSubscriptionGrantingAccess(sub)) {
      continue;
    }

    if (sub.productKey && sub.planKey) {
      const product = catalog[sub.productKey];
      if (product && product.enabled) {
        const plan = product.availablePlans.find(p => p.key === sub.planKey);
        if (plan) {
          for (const ent of plan.entitlements) {
            addSource(ent, {
              sourceType: "direct",
              subscriptionId: sub.subscriptionId,
              sourceKey: sub.productKey,
            });
          }
        }
      }
    } else if (sub.bundleKey) {
      const bundle = bundles[sub.bundleKey];
      if (bundle && bundle.enabled) {
        for (const ent of bundle.includedEntitlements) {
          addSource(ent, {
            sourceType: "bundle",
            subscriptionId: sub.subscriptionId,
            sourceKey: sub.bundleKey,
          });
        }
      }
    }
  }

  return effective as EffectiveEntitlementSet;
}
