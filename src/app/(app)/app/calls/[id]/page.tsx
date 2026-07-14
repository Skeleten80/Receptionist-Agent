import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;

  const { data: call } = await supabase.from("calls_safe").select("*").eq("id", id).maybeSingle();
  if (!call) {
    const { data: fallback } = await supabase.from("calls").select("*").eq("id", id).maybeSingle();
    if (!fallback) notFound();
    return <CallView call={fallback} />;
  }
  return <CallView call={call} />;
}

function CallView({ call }: { call: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Call detail</h1>
      <Card>
        <CardTitle>Overview</CardTitle>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-500">Caller</dt>
            <dd>{String(call.caller_phone_e164 ?? "—")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Outcome</dt>
            <dd>{String(call.outcome ?? call.status)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Duration</dt>
            <dd>{String(call.duration_seconds ?? "—")}s</dd>
          </div>
          <div>
            <dt className="text-slate-500">Sentiment</dt>
            <dd>{String(call.sentiment ?? "—")}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <CardTitle>Summary</CardTitle>
        <p className="mt-2 whitespace-pre-wrap text-sm">{String(call.summary ?? "No summary")}</p>
      </Card>
      <Card>
        <CardTitle>Transcript</CardTitle>
        <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{String(call.transcript ?? "No transcript")}</pre>
      </Card>
      <Card>
        <CardTitle>Structured result</CardTitle>
        <pre className="mt-2 overflow-auto rounded bg-slate-100 p-3 text-xs">
          {JSON.stringify(call.structured_result ?? {}, null, 2)}
        </pre>
      </Card>
    </div>
  );
}
