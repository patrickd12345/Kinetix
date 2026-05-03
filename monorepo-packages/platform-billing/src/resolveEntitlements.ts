import type {
  UserSubscription,
  AdminPricingOverride,
  EffectiveEntitlementSet,
  EntitlementSource,
  EffectiveEntitlement,
  Entitlement,
  ProductKey,
  PlanKey,
  CatalogPlan
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

  // Pre-build a Map of products to their plans to avoid O(N*M) lookup in the loop
  const productPlansMap = new Map<ProductKey, Map<PlanKey, CatalogPlan>>();
  for (const [key, product] of Object.entries(catalog)) {
    if (product && product.enabled) {
      const planMap = new Map<PlanKey, CatalogPlan>();
      for (const plan of product.availablePlans) {
        planMap.set(plan.key, plan);
      }
      productPlansMap.set(key as ProductKey, planMap);
    }
  }

  // Use Sets to track processed subscription IDs to avoid O(N*K) duplicate checks
  const processedSources = new Map<Entitlement, Set<string>>();

  const addSource = (entitlement: Entitlement, source: EntitlementSource) => {
    if (!effective[entitlement]) {
      effective[entitlement] = { entitlement, sources: [] };
      processedSources.set(entitlement, new Set<string>());
    }

    const seen = processedSources.get(entitlement)!;
    if (!seen.has(source.subscriptionId)) {
      effective[entitlement]!.sources.push(source);
      seen.add(source.subscriptionId);
    }
  };

  for (const sub of subscriptions) {
    if (!isSubscriptionGrantingAccess(sub)) {
      continue;
    }

    if (sub.productKey && sub.planKey) {
      const productPlans = productPlansMap.get(sub.productKey);
      if (productPlans) {
        const plan = productPlans.get(sub.planKey);
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
