import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function updateProfile(formData: FormData) {
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
    .eq("status", "active")
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!membership) return;
  await supabase
    .from("organizations")
    .update({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      service_area: String(formData.get("service_area") ?? ""),
      public_phone: String(formData.get("public_phone") ?? ""),
      website: String(formData.get("website") ?? ""),
      city: String(formData.get("city") ?? ""),
      province: String(formData.get("province") ?? "ON"),
    })
    .eq("id", membership.organization_id);
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <p>Please log in.</p>;
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const org = membership?.organizations as unknown as Record<string, string> | null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Business profile</h1>
      <Card>
        <CardTitle>Organization details</CardTitle>
        <form action={updateProfile} className="mt-4 grid gap-3 md:grid-cols-2">
          <input name="name" defaultValue={org?.name ?? ""} className="h-10 rounded-md border px-3 text-sm" required />
          <input name="public_phone" defaultValue={org?.public_phone ?? ""} className="h-10 rounded-md border px-3 text-sm" placeholder="Public phone" />
          <input name="city" defaultValue={org?.city ?? ""} className="h-10 rounded-md border px-3 text-sm" />
          <input name="province" defaultValue={org?.province ?? "ON"} className="h-10 rounded-md border px-3 text-sm" />
          <input name="service_area" defaultValue={org?.service_area ?? ""} className="h-10 rounded-md border px-3 text-sm md:col-span-2" placeholder="Service area" />
          <input name="website" defaultValue={org?.website ?? ""} className="h-10 rounded-md border px-3 text-sm md:col-span-2" />
          <textarea name="description" defaultValue={org?.description ?? ""} className="rounded-md border p-2 text-sm md:col-span-2" rows={4} />
          <Button type="submit">Save</Button>
        </form>
      </Card>
    </div>
  );
}
