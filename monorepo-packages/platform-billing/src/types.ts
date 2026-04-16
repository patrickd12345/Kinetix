export type ProductKey = "kinetix" | "myassist" | "mychesscoach";

export type PlanKey = "pro";

export type BundleKey = "bookiji_one";

export type CurrencyCode = "USD";

export type BillingInterval = "month" | "year";

// Explicit list of all possible entitlements in Spine Billing
export type Entitlement = "kinetix_pro" | "myassist_pro" | "mychesscoach_pro" | "bookiji_one";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "expired";

export interface CatalogPlan {
  key: PlanKey;
  displayName: string;
  price: number;
  currency: CurrencyCode;
  interval: BillingInterval;
  entitlements: Entitlement[];
}

export interface CatalogProduct {
  key: ProductKey;
  displayName: string;
  billingEligible: boolean;
  enabled: boolean;
  excludedFromSpine: boolean;
  availablePlans: CatalogPlan[];
}

export interface CatalogBundle {
  key: BundleKey;
  displayName: string;
  enabled: boolean;
  price: number;
  currency: CurrencyCode;
  interval: BillingInterval;
  includedEntitlements: Entitlement[];
  displaySavingsMessaging?: string;
}

export interface UserSubscription {
  subscriptionId: string;
  productKey?: ProductKey;
  bundleKey?: BundleKey;
  planKey?: PlanKey;
  status: SubscriptionStatus;
}

export interface EntitlementSource {
  sourceType: "direct" | "bundle";
  subscriptionId: string;
  sourceKey: ProductKey | BundleKey;
}

export interface EffectiveEntitlement {
  entitlement: Entitlement;
  sources: EntitlementSource[];
}

export type EffectiveEntitlementSet = Record<Entitlement, EffectiveEntitlement>;

export interface AdminPricingOverride {
  products?: Partial<
    Record<
      ProductKey,
      {
        enabled?: boolean;
        plans?: Partial<Record<PlanKey, { price?: number; enabled?: boolean }>>;
      }
    >
  >;
  bundles?: Partial<
    Record<
      BundleKey,
      {
        enabled?: boolean;
        price?: number;
        includedEntitlements?: Entitlement[];
      }
    >
  >;
}
