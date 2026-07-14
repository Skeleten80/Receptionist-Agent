import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
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
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <Card>
        <CardTitle>Directory</CardTitle>
        {!customers?.length ? (
          <p className="mt-3 text-sm text-slate-500">No customers yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {customers.map((c) => (
              <li key={c.id}>
                {c.first_name} {c.last_name} · {c.phone_e164} · {c.email}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
