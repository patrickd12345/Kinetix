import { describe, it, expect } from "vitest";
import { validatePricingConfig } from "../validation";

describe("validatePricingConfig", () => {
  it("returns no errors for a valid pricing override", () => {
    const errors = validatePricingConfig({
      products: {
        kinetix: {
          plans: {
            pro: { price: 9.99 },
          },
        },
      },
    });
    expect(errors.length).toBe(0);
  });

  it("detects negative pricing for products", () => {
    const errors = validatePricingConfig({
      products: {
        kinetix: {
          plans: {
            pro: { price: -5.0 },
          },
        },
      },
    });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Negative pricing");
  });

  it("detects negative pricing for bundles", () => {
    const errors = validatePricingConfig({
      bundles: {
        bookiji_one: { price: -10 },
      },
    });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Negative pricing");
  });

  it("detects unknown entitlements in bundle config", () => {
    const errors = validatePricingConfig({
      bundles: {
        bookiji_one: {
          includedEntitlements: ["some_made_up_pro" as any],
        },
      },
    });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("Unknown entitlement");
  });

  it("detects attempt to include 'bookiji' (an excluded product) in spine bundle", () => {
    const errors = validatePricingConfig({
      bundles: {
        bookiji_one: {
          // If admin tries to add bookiji_pro conceptually mapping to bookiji
          includedEntitlements: ["bookiji_pro" as any],
        },
      },
    });
    // Two errors: one for unknown entitlement, one for excluded product inclusion.
    expect(errors.some(e => e.includes("Excluded product") && e.includes("cannot be included"))).toBe(true);
  });
});
