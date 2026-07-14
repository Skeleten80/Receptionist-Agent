import { addFaqAction } from "@/app/(app)/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FaqsSettingsPage() {
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
  const { data: faqs } = await supabase
    .from("faqs")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">FAQs</h1>
      <Card>
        <CardTitle>Add FAQ</CardTitle>
        <form action={addFaqAction.bind(null, membership.organization_id)} className="mt-4 grid gap-3">
          <Input name="question" placeholder="Question" required />
          <textarea name="answer" required className="rounded-md border p-2 text-sm" rows={4} placeholder="Answer" />
          <Input name="category" placeholder="Category" />
          <Button type="submit">Add</Button>
        </form>
      </Card>
      <Card>
        <CardTitle>Approved answers</CardTitle>
        <ul className="mt-3 space-y-3 text-sm">
          {(faqs ?? []).map((f) => (
            <li key={f.id}>
              <div className="font-medium">{f.question}</div>
              <div className="text-slate-600">{f.answer}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
