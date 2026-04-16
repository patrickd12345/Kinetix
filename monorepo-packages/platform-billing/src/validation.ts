import type { AdminPricingOverride, Entitlement } from "./types";
import { excludedProducts } from "./constants";

const VALID_ENTITLEMENTS = new Set<Entitlement>([
  "kinetix_pro",
  "myassist_pro",
  "mychesscoach_pro",
  "bookiji_one",
]);

export function validatePricingConfig(override: AdminPricingOverride): string[] {
  const errors: string[] = [];

  if (override.products) {
    for (const [productKey, product] of Object.entries(override.products)) {
      if (product.plans) {
        for (const [planKey, plan] of Object.entries(product.plans)) {
          if (plan.price !== undefined && plan.price < 0) {
            errors.push(`Negative pricing for product ${productKey} plan ${planKey}: ${plan.price}`);
          }
        }
      }
    }
  }

  if (override.bundles) {
    for (const [bundleKey, bundle] of Object.entries(override.bundles)) {
      if (bundle.price !== undefined && bundle.price < 0) {
        errors.push(`Negative pricing for bundle ${bundleKey}: ${bundle.price}`);
      }

      if (bundle.includedEntitlements) {
        for (const entitlement of bundle.includedEntitlements) {
          if (!VALID_ENTITLEMENTS.has(entitlement)) {
            errors.push(`Unknown entitlement in bundle ${bundleKey}: ${entitlement}`);
          }
          if (excludedProducts.includes(entitlement.replace("_pro", ""))) {
            errors.push(`Excluded product ${entitlement} cannot be included in a spine bundle`);
          }
        }
      }
    }
  }

  return errors;
}
