import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type MembershipRole = "owner" | "member";

export type AuthContext = {
  userId: string;
  email: string | undefined;
};

export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AppError("AUTHENTICATION", "Authentication required");
  }
  return { userId: data.user.id, email: data.user.email };
}

export async function requireOrgMembership(
  organizationId: string,
  options?: { role?: MembershipRole },
) {
  const auth = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw new AppError("AUTHORIZATION", "You do not have access to this organization");
  }
  if (options?.role === "owner" && data.role !== "owner") {
    throw new AppError("AUTHORIZATION", "Owner role required");
  }
  return { ...auth, role: data.role as MembershipRole, membershipId: data.id as string };
}

export async function getUserOrganizations() {
  const auth = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role, status, organizations(*)")
    .eq("user_id", auth.userId)
    .eq("status", "active");
  if (error) throw new AppError("INTERNAL", error.message);
  return data ?? [];
}
