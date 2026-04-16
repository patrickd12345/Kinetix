import type { CatalogProduct } from "./types";

export const BASE_CATALOG: Record<string, CatalogProduct> = {
  kinetix: {
    key: "kinetix",
    displayName: "Kinetix",
    billingEligible: true,
    enabled: true,
    excludedFromSpine: false,
    availablePlans: [
      {
        key: "pro",
        displayName: "Kinetix Pro",
        price: 7.99,
        currency: "USD",
        interval: "month",
        entitlements: ["kinetix_pro"],
      },
    ],
  },
  myassist: {
    key: "myassist",
    displayName: "MyAssist",
    billingEligible: true,
    enabled: true,
    excludedFromSpine: false,
    availablePlans: [
      {
        key: "pro",
        displayName: "MyAssist Pro",
        price: 9.99,
        currency: "USD",
        interval: "month",
        entitlements: ["myassist_pro"],
      },
    ],
  },
  mychesscoach: {
    key: "mychesscoach",
    displayName: "MyChessCoach",
    billingEligible: true,
    enabled: true,
    excludedFromSpine: false,
    availablePlans: [
      {
        key: "pro",
        displayName: "MyChessCoach Pro",
        price: 7.99,
        currency: "USD",
        interval: "month",
        entitlements: ["mychesscoach_pro"],
      },
    ],
  },
};
