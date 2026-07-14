import Stripe from "stripe";
import { getStripePriceId, type PlanId } from "@/lib/billing/plans";
import { AppError } from "@/lib/errors";
import { createServiceClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError("PROVIDER", "STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

export async function createCheckoutSession(input: {
  organizationId: string;
  planId: PlanId;
  customerEmail: string;
  stripeCustomerId?: string | null;
}) {
  const priceId = getStripePriceId(input.planId);
  if (!priceId) throw new AppError("VALIDATION", `Missing Stripe price for plan ${input.planId}`);

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.stripeCustomerId || undefined,
    customer_email: input.stripeCustomerId ? undefined : input.customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/app/settings/billing?checkout=cancel`,
    subscription_data: {
      trial_period_days: Number(process.env.STRIPE_TRIAL_DAYS ?? 14) || undefined,
      metadata: { organizationId: input.organizationId, planId: input.planId },
    },
    metadata: { organizationId: input.organizationId, planId: input.planId },
  });

  return session;
}

export async function createBillingPortalSession(stripeCustomerId: string) {
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/app/settings/billing`,
  });
}

export async function syncStripeSubscriptionFromEvent(event: Stripe.Event) {
  const admin = createServiceClient();

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const organizationId = sub.metadata.organizationId;
    if (!organizationId) throw new Error("Missing organizationId on subscription metadata");

    const priceId = sub.items.data[0]?.price.id;
    const plan = (sub.metadata.planId as PlanId) || "starter";
    const status = sub.status;

    const periodStart =
      "current_period_start" in sub && typeof sub.current_period_start === "number"
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null;
    const periodEnd =
      "current_period_end" in sub && typeof sub.current_period_end === "number"
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

    await admin.from("subscriptions").upsert(
      {
        organization_id: organizationId,
        stripe_customer_id: String(sub.customer),
        stripe_subscription_id: sub.id,
        stripe_price_id: priceId,
        plan,
        status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: "organization_id" },
    );

    await admin
      .from("organizations")
      .update({ subscription_status: status === "canceled" ? "canceled" : status })
      .eq("id", organizationId);

    await writeAuditLog({
      organizationId,
      action: `stripe.${event.type}`,
      entityType: "subscription",
      metadata: { status, plan },
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) return;
    await admin.from("subscriptions").upsert(
      {
        organization_id: organizationId,
        stripe_customer_id: String(session.customer ?? ""),
        plan: (session.metadata?.planId as PlanId) || "starter",
        status: "active",
      },
      { onConflict: "organization_id" },
    );
  }
}
