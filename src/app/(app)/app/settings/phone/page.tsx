import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

async function savePhone(formData: FormData) {
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
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("is_primary", true)
    .maybeSingle();
  await supabase.from("phone_numbers").insert({
    organization_id: membership.organization_id,
    provider: "twilio",
    e164_number: String(formData.get("e164_number") ?? ""),
    friendly_name: String(formData.get("friendly_name") ?? ""),
    provider_phone_number_id: String(formData.get("provider_phone_number_id") ?? `manual_${Date.now()}`),
    status: "pending",
    ai_agent_id: agent?.id ?? null,
  });
}

export default async function PhoneSettingsPage() {
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
  const { data: numbers } = await supabase
    .from("phone_numbers")
    .select("id, e164_number, friendly_name, status, provider")
    .eq("organization_id", membership.organization_id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Phone number</h1>
      <Card>
        <CardTitle>Connect a Canadian / Twilio-compatible number</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Automatic provisioning requires Twilio credentials (see docs/TWILIO_SETUP.md). You can register an existing
          number here; credentials are never shown after save.
        </p>
        <form action={savePhone} className="mt-4 grid gap-3 md:grid-cols-2">
          <Input name="e164_number" placeholder="+15195550123" required />
          <Input name="friendly_name" placeholder="Main line" />
          <Input name="provider_phone_number_id" placeholder="Twilio PN SID (optional)" />
          <Button type="submit">Save number</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>Numbers</CardTitle>
        <ul className="mt-3 space-y-2 text-sm">
          {(numbers ?? []).map((n) => (
            <li key={n.id}>
              {n.e164_number} · {n.status} · {n.provider}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
