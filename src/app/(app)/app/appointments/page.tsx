import { createManualAppointmentAction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
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

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Appointments</h1>
      <Card>
        <CardTitle>Manual appointment request</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Creates a <strong>pending</strong> request. Does not claim the appointment is confirmed.
        </p>
        <form
          action={createManualAppointmentAction.bind(null, membership.organization_id)}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <Input name="caller_name" placeholder="Caller name" />
          <Input name="caller_phone" placeholder="Caller phone +1..." />
          <Input name="preferred_date" type="date" required />
          <Input name="preferred_time_window" placeholder="e.g. morning / 9-11am" required />
          <Input name="customer_notes" placeholder="Notes" className="md:col-span-2" />
          <div className="md:col-span-2">
            <Button type="submit">Create pending request</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardTitle>Requests</CardTitle>
        {!appointments?.length ? (
          <p className="mt-3 text-sm text-slate-500">No appointments yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {appointments.map((a) => (
              <li key={a.id} className="rounded border border-slate-200 p-3">
                <div className="font-medium">
                  {a.status} — {a.preferred_date ?? a.starts_at} {a.preferred_time_window}
                </div>
                <div className="text-slate-500">{a.customer_notes}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
