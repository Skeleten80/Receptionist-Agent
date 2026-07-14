import { saveReceptionistAction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { SimulateCallButton } from "@/components/dashboard/simulate-call-button";

export const dynamic = "force-dynamic";

async function getOrgId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export default async function ReceptionistPage() {
  let orgId: string | null = null;
  let agent: Record<string, unknown> | null = null;
  try {
    orgId = await getOrgId();
    if (orgId) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_primary", true)
        .maybeSingle();
      agent = data;
    }
  } catch {
    orgId = null;
  }

  if (!orgId) {
    return <p className="text-slate-600">Create an organization first.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Receptionist</h1>
        <p className="text-sm text-slate-500">
          Business-supplied text is treated as untrusted configuration and injected into a controlled prompt template.
        </p>
      </div>
      <Card>
        <CardTitle>Configuration</CardTitle>
        <form action={saveReceptionistAction.bind(null, orgId)} className="mt-4 grid gap-3">
          <Input name="name" defaultValue={String(agent?.name ?? "LocalAgent Receptionist")} required />
          <label className="text-sm">
            Greeting
            <textarea
              name="greeting"
              required
              className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
              rows={3}
              defaultValue={String(
                agent?.greeting ??
                  "Hi, you've reached our team. I'm the automated receptionist. This call may be recorded.",
              )}
            />
          </label>
          <Input name="transfer_phone" placeholder="Transfer phone +1..." defaultValue={String(agent?.transfer_phone ?? "")} />
          <Input name="voice_id" placeholder="Voice ID (optional)" defaultValue={String(agent?.voice_id ?? "")} />
          <Input name="tone" defaultValue={String(agent?.tone ?? "warm_professional")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="transfer_enabled" defaultChecked={Boolean(agent?.transfer_enabled ?? true)} />
            Enable transfers
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recording_enabled" defaultChecked={Boolean(agent?.recording_enabled)} />
            Enable recording
          </label>
          <Button type="submit">Save & sync assistant</Button>
        </form>
        {agent?.provider_assistant_id ? (
          <p className="mt-3 text-xs text-slate-500">Provider assistant: {String(agent.provider_assistant_id)}</p>
        ) : null}
        {agent?.system_prompt ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">Prompt preview</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-100 p-3 text-xs">
              {String(agent.system_prompt)}
            </pre>
          </details>
        ) : null}
      </Card>
      <Card>
        <CardTitle>Test / simulate end-of-call</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Sends a signature-verified payload to <code>/api/webhooks/vapi</code> (mock signature allowed when
          VAPI_MOCK_MODE=true).
        </p>
        <div className="mt-4">
          <SimulateCallButton organizationId={orgId} />
        </div>
      </Card>
    </div>
  );
}
