import { describe, it, expect } from "vitest";
import { resolveEntitlements } from "../resolveEntitlements";
import type { UserSubscription } from "../types";

describe("resolveEntitlements", () => {
  it("grants access for an active direct subscription", () => {
    const subs: UserSubscription[] = [
      {
        subscriptionId: "sub_1",
        productKey: "kinetix",
        planKey: "pro",
        status: "active",
      },
    ];

    const entitlements = resolveEntitlements(subs);

    expect(entitlements["kinetix_pro"]).toBeDefined();
    expect(entitlements["kinetix_pro"]?.sources.length).toBe(1);
    expect(entitlements["kinetix_pro"]?.sources[0]).toEqual({
      sourceType: "direct",
      subscriptionId: "sub_1",
      sourceKey: "kinetix",
    });
  });

  it("grants multiple included entitlements for a bundle subscription", () => {
    const subs: UserSubscription[] = [
      {
        subscriptionId: "sub_2",
        bundleKey: "bookiji_one",
        status: "active",
      },
    ];

    const entitlements = resolveEntitlements(subs);

    expect(entitlements["kinetix_pro"]).toBeDefined();
    expect(entitlements["myassist_pro"]).toBeDefined();
    expect(entitlements["mychesscoach_pro"]).toBeDefined();
    expect(entitlements["bookiji_one"]).toBeDefined();

    expect(entitlements["kinetix_pro"]?.sources[0].sourceType).toBe("bundle");
    expect(entitlements["kinetix_pro"]?.sources[0].sourceKey).toBe("bookiji_one");
  });

  it("combines sources properly for overlapping direct and bundle subscriptions", () => {
    const subs: UserSubscription[] = [
      {
        subscriptionId: "sub_1",
        productKey: "kinetix",
        planKey: "pro",
        status: "active",
      },
      {
        subscriptionId: "sub_2",
        bundleKey: "bookiji_one",
        status: "active",
      },
    ];

    const entitlements = resolveEntitlements(subs);

    expect(entitlements["kinetix_pro"]).toBeDefined();
    // Should have 2 sources: direct and bundle
    expect(entitlements["kinetix_pro"]?.sources.length).toBe(2);

    const sourceTypes = entitlements["kinetix_pro"]!.sources.map(s => s.sourceType);
    expect(sourceTypes).toContain("direct");
    expect(sourceTypes).toContain("bundle");
  });

  it("ignores inactive or canceled subscriptions", () => {
    const subs: UserSubscription[] = [
      {
        subscriptionId: "sub_1",
        productKey: "kinetix",
        planKey: "pro",
        status: "canceled",
      },
      {
        subscriptionId: "sub_2",
        bundleKey: "bookiji_one",
        status: "expired",
      },
    ];

    const entitlements = resolveEntitlements(subs);
    expect(Object.keys(entitlements).length).toBe(0);
  });

  it("ignores unknown or disabled products/bundles", () => {
    const subs: UserSubscription[] = [
      {
        subscriptionId: "sub_1",
        productKey: "kinetix",
        planKey: "pro",
        status: "active",
      },
    ];

    // Override kinetix to be disabled
    const entitlements = resolveEntitlements(subs, {
      products: {
        kinetix: {
          enabled: false,
        },
      },
    });

    expect(entitlements["kinetix_pro"]).toBeUndefined();
  });
});
