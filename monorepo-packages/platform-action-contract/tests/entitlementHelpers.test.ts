import { describe, it, expect } from "vitest";
import { resolveSuggestionMode, ownsProduct, shouldShowSoftSuggestion, getUpsellMessage, EntitlementContext } from "../src/entitlementHelpers";

describe("entitlementHelpers", () => {
    it("ownsProduct handles bookiji correctly", () => {
        const ctxOwned: EntitlementContext = { ownsProduct: true, hasSpineEntitlement: false };
        const ctxNotOwned: EntitlementContext = { ownsProduct: false, hasSpineEntitlement: true };

        expect(ownsProduct("bookiji", ctxOwned)).toBe(true);
        expect(ownsProduct("bookiji", ctxNotOwned)).toBe(false);
    });

    it("ownsProduct handles spine products correctly", () => {
        const ctxOwned: EntitlementContext = { ownsProduct: false, hasSpineEntitlement: true };

        expect(ownsProduct("kinetix", ctxOwned)).toBe(true);
    });

    it("resolveSuggestionMode returns action if owned", () => {
        const ctxOwned: EntitlementContext = { ownsProduct: true, hasSpineEntitlement: false };
        expect(resolveSuggestionMode("bookiji", ctxOwned)).toBe("action");
    });

    it("resolveSuggestionMode returns soft if not owned", () => {
        const ctxNotOwned: EntitlementContext = { ownsProduct: false, hasSpineEntitlement: false };
        expect(resolveSuggestionMode("bookiji", ctxNotOwned)).toBe("soft");
    });

    it("getUpsellMessage handles bookiji", () => {
        expect(getUpsellMessage("bookiji")).toBe("Available with Bookiji");
    });
});
