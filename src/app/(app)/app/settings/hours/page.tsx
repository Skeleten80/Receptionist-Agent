import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function saveHours(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return;
  for (let day = 0; day < 7; day++) {
    const isOpen = formData.get(`open_${day}`) === "on";
    await supabase.from("business_hours").upsert(
      {
        organization_id: membership.organization_id,
        day_of_week: day,
        is_open: isOpen,
        open_time: isOpen ? String(formData.get(`start_${day}`) || "09:00") : null,
        close_time: isOpen ? String(formData.get(`end_${day}`) || "17:00") : null,
      },
      { onConflict: "organization_id,day_of_week" },
    );
  }
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function HoursSettingsPage() {
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
  const { data: hours } = await supabase
    .from("business_hours")
    .select("*")
    .eq("organization_id", membership.organization_id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Business hours</h1>
      <Card>
        <CardTitle>Weekly schedule</CardTitle>
        <form action={saveHours} className="mt-4 space-y-3">
          {DAYS.map((label, day) => {
            const row = hours?.find((h) => h.day_of_week === day);
            return (
              <div key={label} className="grid grid-cols-4 items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name={`open_${day}`} defaultChecked={row?.is_open ?? day < 5} />
                  {label}
                </label>
                <input name={`start_${day}`} type="time" defaultValue={row?.open_time?.slice(0, 5) ?? "09:00"} className="rounded border px-2 py-1" />
                <input name={`end_${day}`} type="time" defaultValue={row?.close_time?.slice(0, 5) ?? "17:00"} className="rounded border px-2 py-1" />
              </div>
            );
          })}
          <Button type="submit">Save hours</Button>
        </form>
      </Card>
    </div>
  );
}
