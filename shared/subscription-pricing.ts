export const PAID_SUBSCRIPTION_PLANS = ["Pro", "Enterprise"] as const;
export type PaidSubscriptionPlan = (typeof PAID_SUBSCRIPTION_PLANS)[number];
export type PaidBillingPeriod = "monthly" | "annual";

export const SUBSCRIPTION_PRICES: Record<PaidSubscriptionPlan, Record<PaidBillingPeriod, number>> = {
  Pro: { monthly: 3_999, annual: 10_000 },
  Enterprise: { monthly: 5_999, annual: 15_000 },
};

export function getSubscriptionPrice(plan: PaidSubscriptionPlan, period: PaidBillingPeriod): number {
  return SUBSCRIPTION_PRICES[plan][period];
}

export function formatKsh(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE")}`;
}
