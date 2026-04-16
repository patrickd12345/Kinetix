import type { SubscriptionStatus, UserSubscription } from "./types";

export function isSubscriptionActiveLike(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

export function isSubscriptionBillable(status: SubscriptionStatus): boolean {
  return status === "active" || status === "past_due";
}

export function isSubscriptionGrantingAccess(subscription: UserSubscription): boolean {
  return isSubscriptionActiveLike(subscription.status) || subscription.status === "past_due";
}
