import { CatalogBundle } from "./types";

export const BASE_BUNDLES: Record<string, CatalogBundle> = {
  bookiji_one: {
    key: "bookiji_one",
    displayName: "Bookiji One",
    enabled: true,
    price: 15.0,
    currency: "USD",
    interval: "month",
    includedEntitlements: ["kinetix_pro", "myassist_pro", "mychesscoach_pro", "bookiji_one"],
    displaySavingsMessaging: "Save over $10/month when bundled",
  },
};
