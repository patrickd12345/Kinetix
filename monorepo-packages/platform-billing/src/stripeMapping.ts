import type { ProductKey, PlanKey, BundleKey } from "./types";

export interface StripeMapping {
  stripeProductId: string;
  stripePriceId: string;
}

// These are placeholder mappings for future integration.
// Do not use for production API calls yet.

export const STRIPE_PRODUCT_MAPPING: Record<ProductKey, StripeMapping> = {
  kinetix: {
    stripeProductId: "prod_placeholder_kinetix",
    stripePriceId: "price_placeholder_kinetix_pro",
  },
  myassist: {
    stripeProductId: "prod_placeholder_myassist",
    stripePriceId: "price_placeholder_myassist_pro",
  },
  mychesscoach: {
    stripeProductId: "prod_placeholder_mychesscoach",
    stripePriceId: "price_placeholder_mychesscoach_pro",
  },
};

export const STRIPE_BUNDLE_MAPPING: Record<BundleKey, StripeMapping> = {
  bookiji_one: {
    stripeProductId: "prod_placeholder_bookiji_one",
    stripePriceId: "price_placeholder_bookiji_one",
  },
};
