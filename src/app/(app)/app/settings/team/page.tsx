import { Card, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return <p>No organization.</p>;
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("id, role, status, user_id, profiles(full_name)")
    .eq("organization_id", membership.organization_id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Card>
        <CardTitle>Members</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {(members ?? []).map((m) => {
            const profile = m.profiles as { full_name?: string } | { full_name?: string }[] | null;
            const name = Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;
            return (
              <li key={m.id}>
                {name ?? m.user_id} · {m.role} · {m.status}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-slate-500">
          Invitation emails require Resend configuration. Owners can invite members via team_invitations (tokenized).
        </p>
      </Card>
    </div>
  );
}
