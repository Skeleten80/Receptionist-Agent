import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;
  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_platform_admin) {
    return <p className="text-slate-600">Platform administrator access required.</p>;
  }
  const { data: events } = await supabase
    .from("webhook_events")
    .select("id, provider, event_type, processing_status, last_error, received_at, attempts")
    .order("received_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Integration events</h1>
      <Card>
        <CardTitle>Webhook processing</CardTitle>
        <p className="mt-2 text-xs text-slate-500">Credentials are never shown on this page.</p>
        <ul className="mt-4 space-y-2 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id} className="rounded border p-2">
              {e.provider} · {e.event_type} · {e.processing_status}
              {e.last_error ? <div className="text-red-600">{e.last_error}</div> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
