/**
 * Bookiji is specifically excluded from Spine billing.
 * It remains its own separate payment universe.
 * Examples:
 * - Bookiji vendor subscriptions
 * - Bookiji marketplace fees
 * - Bookiji consumer commitment/payment flows
 * These must not be modeled as Spine subscriptions.
 */
export const excludedProducts: string[] = ["bookiji"];
