export type PlanId = "starter" | "growth" | "pro";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  description: string;
  monthlyCallMinutes: number;
  maxPhoneNumbers: number;
  maxTeamMembers: number;
  googleCalendar: boolean;
  callTransfers: boolean;
  advancedAnalytics: boolean;
  dataExport: boolean;
  prioritySupport: boolean;
  stripePriceEnvKey: "STRIPE_PRICE_STARTER" | "STRIPE_PRICE_GROWTH" | "STRIPE_PRICE_PRO";
  /** Display-only placeholder; real price comes from Stripe Price objects */
  displayPriceLabel: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "One receptionist, basic lead capture, manual appointment requests.",
    monthlyCallMinutes: 300,
    maxPhoneNumbers: 1,
    maxTeamMembers: 2,
    googleCalendar: false,
    callTransfers: false,
    advancedAnalytics: false,
    dataExport: false,
    prioritySupport: false,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    displayPriceLabel: "From Stripe price",
  },
  growth: {
    id: "growth",
    name: "Growth",
    description: "Higher minutes, Google Calendar, transfers, team seats, notifications.",
    monthlyCallMinutes: 1200,
    maxPhoneNumbers: 2,
    maxTeamMembers: 10,
    googleCalendar: true,
    callTransfers: true,
    advancedAnalytics: true,
    dataExport: false,
    prioritySupport: false,
    stripePriceEnvKey: "STRIPE_PRICE_GROWTH",
    displayPriceLabel: "From Stripe price",
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Highest usage, advanced routing options, export, priority support.",
    monthlyCallMinutes: 5000,
    maxPhoneNumbers: 5,
    maxTeamMembers: 50,
    googleCalendar: true,
    callTransfers: true,
    advancedAnalytics: true,
    dataExport: true,
    prioritySupport: true,
    stripePriceEnvKey: "STRIPE_PRICE_PRO",
    displayPriceLabel: "From Stripe price",
  },
};

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId];
}

export function getStripePriceId(planId: PlanId): string | undefined {
  const key = PLANS[planId].stripePriceEnvKey;
  return process.env[key] || undefined;
}

export function isSubscriptionAccessAllowed(status: string | null | undefined): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

export function isReadOnlySubscription(status: string | null | undefined): boolean {
  return status === "past_due" || status === "canceled" || status === "unpaid" || status === "none";
}

export function calculateUsagePercent(usedMinutes: number, planId: PlanId): number {
  const limit = PLANS[planId].monthlyCallMinutes;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((usedMinutes / limit) * 100));
}
