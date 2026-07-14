import { addServiceAction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ServicesSettingsPage() {
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
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Services</h1>
      <Card>
        <CardTitle>Add service</CardTitle>
        <form action={addServiceAction.bind(null, membership.organization_id)} className="mt-4 grid gap-3 md:grid-cols-2">
          <Input name="name" placeholder="Service name" required />
          <Input name="duration_minutes" type="number" defaultValue={60} />
          <Input name="description" placeholder="Description" className="md:col-span-2" />
          <Button type="submit">Add</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>Configured services</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {(services ?? []).map((s) => (
            <li key={s.id}>
              {s.name} · {s.duration_minutes} min {s.is_active ? "" : "(inactive)"}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
