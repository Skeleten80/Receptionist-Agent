import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, status, priority, job_description, created_at, customers(first_name,last_name,phone_e164)")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <Card>
        <CardTitle>Pipeline</CardTitle>
        {!leads?.length ? (
          <p className="mt-3 text-sm text-slate-500">No leads yet.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {leads.map((lead) => {
              const customer = lead.customers as
                | { first_name?: string; last_name?: string; phone_e164?: string }
                | { first_name?: string; last_name?: string; phone_e164?: string }[]
                | null;
              const c = Array.isArray(customer) ? customer[0] : customer;
              return (
                <li key={lead.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <Link href={`/app/leads/${lead.id}`} className="font-medium text-teal-700 underline">
                      {c?.first_name || c?.phone_e164 || "Lead"} {c?.last_name ?? ""}
                    </Link>
                    <div className="text-slate-500">{lead.job_description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{lead.status}</div>
                    <div className="text-xs uppercase text-slate-500">{lead.priority}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
