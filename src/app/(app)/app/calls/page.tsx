import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return <p>No organization.</p>;

  const { data: calls } = await supabase
    .from("calls")
    .select("id, caller_phone_e164, started_at, duration_seconds, status, outcome, sentiment, summary")
    .eq("organization_id", membership.organization_id)
    .order("started_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calls</h1>
      <Card>
        <CardTitle>Inbound calls</CardTitle>
        {!calls?.length ? (
          <p className="mt-3 text-sm text-slate-500">No calls yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Caller</th>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Outcome</th>
                  <th className="py-2">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <Link className="text-teal-700 underline" href={`/app/calls/${c.id}`}>
                        {c.caller_phone_e164 ?? "Unknown"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{c.started_at ? new Date(c.started_at).toLocaleString() : "—"}</td>
                    <td className="py-2 pr-4">{c.duration_seconds ?? "—"}</td>
                    <td className="py-2 pr-4">{c.status}</td>
                    <td className="py-2 pr-4">{c.outcome ?? "—"}</td>
                    <td className="py-2">{c.sentiment ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
