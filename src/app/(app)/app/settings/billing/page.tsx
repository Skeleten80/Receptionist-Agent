import { startCheckoutAction, openBillingPortalAction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function BillingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, organizations(subscription_status)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return <p>No organization.</p>;
  if (membership.role !== "owner") {
    return <p className="text-slate-600">Billing is restricted to organization owners.</p>;
  }

  const org = membership.organizations as { subscription_status?: string } | null;
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <Card>
        <CardTitle>Current status</CardTitle>
        <p className="mt-2 text-sm">
          Organization subscription: <strong>{org?.subscription_status ?? "none"}</strong>
        </p>
        <p className="text-sm text-slate-500">
          Stripe subscription: {sub?.status ?? "not started"} / plan {sub?.plan ?? "—"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Stripe webhooks are the source of truth. Client-reported status is never trusted.
        </p>
        <form action={openBillingPortalAction.bind(null, membership.organization_id)} className="mt-4">
          <Button type="submit" variant="secondary">
            Open Stripe Customer Portal
          </Button>
        </form>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((planId) => {
          const plan = PLANS[planId];
          return (
            <Card key={planId}>
              <CardTitle>{plan.name}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
              <form action={startCheckoutAction.bind(null, membership.organization_id, planId)} className="mt-4">
                <Button type="submit">Start Checkout</Button>
              </form>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardTitle>Development test instructions</CardTitle>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_* in .env.local</li>
          <li>Run stripe listen --forward-to localhost:3000/api/webhooks/stripe</li>
          <li>Complete Checkout with test card 4242…</li>
          <li>Confirm subscriptions row and organizations.subscription_status update via webhook</li>
        </ol>
      </Card>
    </div>
  );
}
