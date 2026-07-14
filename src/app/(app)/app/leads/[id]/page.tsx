import { updateLeadStatusAction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;

  const { data: lead } = await supabase
    .from("leads")
    .select("*, customers(*), calls(id, summary), services(name)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Lead</h1>
      <Card>
        <CardTitle>Details</CardTitle>
        <p className="mt-2 text-sm">{lead.job_description}</p>
        <p className="mt-2 text-sm text-slate-500">
          Status: {lead.status} · Priority: {lead.priority}
        </p>
      </Card>
      <Card>
        <CardTitle>Update status</CardTitle>
        <form action={updateLeadStatusAction.bind(null, lead.organization_id, lead.id)} className="mt-3 flex flex-wrap gap-2">
          <select name="status" defaultValue={lead.status} className="h-10 rounded-md border px-3 text-sm">
            {["new", "qualified", "booked", "follow_up", "won", "lost", "spam"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="internal_notes"
            placeholder="Internal notes"
            defaultValue={lead.internal_notes ?? ""}
            className="h-10 flex-1 rounded-md border px-3 text-sm"
          />
          <Button type="submit">Save</Button>
        </form>
      </Card>
    </div>
  );
}
