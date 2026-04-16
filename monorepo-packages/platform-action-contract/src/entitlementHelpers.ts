export type SuggestionMode = "action" | "soft" | "hidden";

export interface EntitlementContext {
    ownsProduct: boolean;
    hasSpineEntitlement: boolean;
}

export function ownsProduct(targetProduct: string, context: EntitlementContext): boolean {
    if (targetProduct === 'bookiji') {
        return context.ownsProduct;
    }
    return context.hasSpineEntitlement;
}

export function resolveSuggestionMode(targetProduct: string, context: EntitlementContext): SuggestionMode {
    if (ownsProduct(targetProduct, context)) {
        return "action";
    }
    return "soft";
}

export function shouldShowSoftSuggestion(mode: SuggestionMode): boolean {
    return mode === "soft";
}

export function getUpsellMessage(productKey: string): string {
    if (productKey === 'bookiji') {
        return "Available with Bookiji";
    }
    return `Included in ${productKey}`;
}
