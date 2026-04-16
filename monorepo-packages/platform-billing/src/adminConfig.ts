import { BASE_CATALOG } from "./catalog";
import { BASE_BUNDLES } from "./bundles";
import type { CatalogProduct, CatalogBundle, AdminPricingOverride } from "./types";

export function resolveCatalogWithOverrides(
  override?: AdminPricingOverride
): Record<string, CatalogProduct> {
  if (!override?.products) return { ...BASE_CATALOG };

  const merged = { ...BASE_CATALOG };

  for (const [key, baseProduct] of Object.entries(merged)) {
    const overrideProduct = override.products[key as keyof typeof override.products];
    if (overrideProduct) {
      const plans = baseProduct.availablePlans.map(plan => {
        const overridePlan = overrideProduct.plans?.[plan.key];
        return overridePlan
          ? {
              ...plan,
              price: overridePlan.price ?? plan.price,
              // Enabled status is derived or injected logic
              // Since availablePlans is structural in catalog, any missing plan is effectively disabled
              // but we only override price for now.
            }
          : plan;
      });

      merged[key] = {
        ...baseProduct,
        enabled: overrideProduct.enabled ?? baseProduct.enabled,
        availablePlans: plans,
      };
    }
  }

  return merged;
}

export function resolveBundlesWithOverrides(
  override?: AdminPricingOverride
): Record<string, CatalogBundle> {
  if (!override?.bundles) return { ...BASE_BUNDLES };

  const merged = { ...BASE_BUNDLES };

  for (const [key, baseBundle] of Object.entries(merged)) {
    const overrideBundle = override.bundles[key as keyof typeof override.bundles];
    if (overrideBundle) {
      merged[key] = {
        ...baseBundle,
        enabled: overrideBundle.enabled ?? baseBundle.enabled,
        price: overrideBundle.price ?? baseBundle.price,
        includedEntitlements: overrideBundle.includedEntitlements ?? baseBundle.includedEntitlements,
      };
    }
  }

  return merged;
}
