import { resolveCatalogWithOverrides, resolveBundlesWithOverrides } from "./adminConfig";
import type { ProductKey, PlanKey, BundleKey, AdminPricingOverride } from "./types";
import { BASE_BUNDLES } from "./bundles";

export function getProductPrice(
  productKey: ProductKey,
  planKey: PlanKey,
  override?: AdminPricingOverride
): number | undefined {
  const catalog = resolveCatalogWithOverrides(override);
  const product = catalog[productKey];
  if (!product || !product.enabled) return undefined;

  const plan = product.availablePlans.find((p) => p.key === planKey);
  return plan?.price;
}

export function getBundlePrice(
  bundleKey: BundleKey,
  override?: AdminPricingOverride
): number | undefined {
  const bundles = resolveBundlesWithOverrides(override);
  const bundle = bundles[bundleKey];
  return bundle?.enabled ? bundle.price : undefined;
}

export function isProductIncludedInBookijiOne(
  productKey: ProductKey,
  override?: AdminPricingOverride
): boolean {
  const bundles = resolveBundlesWithOverrides(override);
  const bookijiOne = bundles["bookiji_one"];
  if (!bookijiOne || !bookijiOne.enabled) return false;

  const expectedEntitlement = `${productKey}_pro` as any;
  return bookijiOne.includedEntitlements.includes(expectedEntitlement);
}

export function getBundleSavings(
  bundleKey: BundleKey,
  override?: AdminPricingOverride
): number {
  if (bundleKey !== "bookiji_one") return 0;

  const catalog = resolveCatalogWithOverrides(override);
  const bundles = resolveBundlesWithOverrides(override);
  const bundle = bundles[bundleKey];

  if (!bundle || !bundle.enabled) return 0;

  let individualTotal = 0;
  for (const ent of bundle.includedEntitlements) {
    if (ent.endsWith("_pro")) {
      const productKey = ent.replace("_pro", "") as ProductKey;
      const price = getProductPrice(productKey, "pro", override);
      if (price) individualTotal += price;
    }
  }

  return individualTotal > bundle.price ? individualTotal - bundle.price : 0;
}

export function getUpgradeMessage(
  bundleKey: BundleKey,
  override?: AdminPricingOverride
): string | undefined {
  const bundles = resolveBundlesWithOverrides(override);
  const bundle = bundles[bundleKey];
  return bundle?.enabled ? bundle.displaySavingsMessaging : undefined;
}
