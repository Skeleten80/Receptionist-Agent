import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculateUsagePercent, PLANS, type PlanId } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let orgId: string | null = null;
  const metrics = {
    totalCalls: 0,
    answered: 0,
    failed: 0,
    qualifiedLeads: 0,
    appointments: 0,
    transferred: 0,
    avgDuration: 0,
    pipelineCents: 0,
    usedMinutes: 0,
    planId: "starter" as PlanId,
    recentCalls: [] as Array<Record<string, unknown>>,
    recentLeads: [] as Array<Record<string, unknown>>,
    upcoming: [] as Array<Record<string, unknown>>,
    onboarding: "started",
    warnings: [] as string[],
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return (
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-slate-600">Please log in.</p>
          <Link href="/login">
            <Button className="mt-4">Log in</Button>
          </Link>
        </div>
      );
    }

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id, organizations(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    orgId = membership?.organization_id ?? null;
    const org = membership?.organizations as { onboarding_status?: string; subscription_status?: string } | null;
    metrics.onboarding = org?.onboarding_status ?? "started";

    if (orgId) {
      const [{ data: calls }, { data: leads }, { data: appts }, { data: usage }, { data: sub }, { data: integrations }] =
        await Promise.all([
          supabase
            .from("calls")
            .select("id, caller_phone_e164, status, outcome, duration_seconds, started_at, transfer_status")
            .eq("organization_id", orgId)
            .order("started_at", { ascending: false })
            .limit(50),
          supabase
            .from("leads")
            .select("id, status, priority, job_description, estimated_value_cents, created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("appointments")
            .select("id, status, preferred_date, preferred_time_window, starts_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase.from("usage_records").select("quantity").eq("organization_id", orgId).eq("usage_type", "call_minutes"),
          supabase.from("subscriptions").select("plan, status").eq("organization_id", orgId).maybeSingle(),
          supabase.from("integrations").select("provider, status, last_error").eq("organization_id", orgId),
        ]);

      const callRows = calls ?? [];
      metrics.totalCalls = callRows.length;
      metrics.answered = callRows.filter((c) => c.status === "ended" || c.status === "completed").length;
      metrics.failed = callRows.filter((c) => c.status === "failed").length;
      metrics.transferred = callRows.filter((c) => c.transfer_status).length;
      const durations = callRows.map((c) => c.duration_seconds ?? 0);
      metrics.avgDuration = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      metrics.recentCalls = callRows.slice(0, 5);

      const leadRows = leads ?? [];
      metrics.qualifiedLeads = leadRows.filter((l) =>
        ["qualified", "booked", "won"].includes(l.status),
      ).length;
      metrics.pipelineCents = leadRows.reduce((sum, l) => sum + (l.estimated_value_cents ?? 0), 0);
      metrics.recentLeads = leadRows.slice(0, 5);

      const apptRows = appts ?? [];
      metrics.appointments = apptRows.filter((a) => a.status === "confirmed" || a.status === "pending").length;
      metrics.upcoming = apptRows.slice(0, 5);

      metrics.usedMinutes = (usage ?? []).reduce((sum, u) => sum + Number(u.quantity ?? 0), 0);
      metrics.planId = (sub?.plan as PlanId) || "starter";

      metrics.warnings = (integrations ?? [])
        .filter((i) => i.status === "error")
        .map((i) => `${i.provider}: ${i.last_error ?? "error"}`);

      if (org?.subscription_status === "past_due") {
        metrics.warnings.push("Subscription past due — update billing to avoid interruption.");
      }
    }
  } catch {
    // Supabase not configured — show empty dashboard shell
  }

  const usagePct = calculateUsagePercent(metrics.usedMinutes, metrics.planId);
  const plan = PLANS[metrics.planId];

  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Welcome to LocalAgent</h1>
        <p className="mt-2 text-slate-600">Create your organization to continue onboarding.</p>
        <Link href="/app/onboarding">
          <Button className="mt-4">Start onboarding</Button>
        </Link>
      </div>
    );
  }

  const tiles = [
    ["Total calls", metrics.totalCalls],
    ["Answered", metrics.answered],
    ["Failed", metrics.failed],
    ["Qualified leads", metrics.qualifiedLeads],
    ["Appointments", metrics.appointments],
    ["Transferred", metrics.transferred],
    ["Avg duration (s)", metrics.avgDuration],
    ["Pipeline ($)", (metrics.pipelineCents / 100).toFixed(2)],
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-500">Onboarding: {metrics.onboarding}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/receptionist">
            <Button variant="secondary">AI Receptionist</Button>
          </Link>
          <Link href="/app/settings/billing">
            <Button variant="secondary">Billing</Button>
          </Link>
        </div>
      </div>

      {metrics.warnings.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardTitle>Integration warnings</CardTitle>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
            {metrics.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>
          Call usage — {plan.name} ({usagePct}% of {plan.monthlyCallMinutes} min)
        </CardTitle>
        <div className="mt-3 h-2 overflow-hidden rounded bg-slate-200">
          <div className="h-full bg-teal-700" style={{ width: `${usagePct}%` }} />
        </div>
        <p className="mt-2 text-sm text-slate-500">{metrics.usedMinutes} minutes used this period</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Recent calls</CardTitle>
          {metrics.recentCalls.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No calls yet. Run a simulated end-of-call webhook from the receptionist page.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {metrics.recentCalls.map((c) => (
                <li key={String(c.id)}>
                  <Link className="text-teal-700 underline" href={`/app/calls/${c.id}`}>
                    {String(c.caller_phone_e164 ?? "Unknown")} — {String(c.outcome ?? c.status)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Recent leads</CardTitle>
          {metrics.recentLeads.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No leads yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {metrics.recentLeads.map((l) => (
                <li key={String(l.id)}>
                  <Link className="text-teal-700 underline" href={`/app/leads/${l.id}`}>
                    {String(l.status)} / {String(l.priority)} — {String(l.job_description ?? "Lead")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Upcoming appointments</CardTitle>
          {metrics.upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No appointments yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {metrics.upcoming.map((a) => (
                <li key={String(a.id)}>
                  {String(a.status)} — {String(a.preferred_date ?? a.starts_at ?? "")}{" "}
                  {String(a.preferred_time_window ?? "")}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
