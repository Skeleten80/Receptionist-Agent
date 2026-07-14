import { AppShell } from "@/components/layout/app-shell";
import { createClient, hasSupabasePublicConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let orgName: string | undefined;
  try {
    if (hasSupabasePublicConfig()) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("organization_memberships")
          .select("organizations(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        const orgs = data?.organizations as { name?: string } | { name?: string }[] | null;
        orgName = Array.isArray(orgs) ? orgs[0]?.name : orgs?.name;
      }
    }
  } catch {
    orgName = undefined;
  }

  return <AppShell orgName={orgName}>{children}</AppShell>;
}
