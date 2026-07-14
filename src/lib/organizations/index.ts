import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { createOrganizationSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function createOrganization(
  userId: string,
  input: z.infer<typeof createOrganizationSchema>,
) {
  const parsed = createOrganizationSchema.parse(input);
  const admin = createServiceClient();
  let slug = slugify(parsed.name);
  const existing = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (existing.data) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name: parsed.name,
      slug,
      industry: parsed.industry,
      timezone: parsed.timezone,
      city: parsed.city ?? null,
      province: parsed.province,
      onboarding_status: "profile",
      onboarding_step: 1,
      subscription_status: "trialing",
    })
    .select("*")
    .single();

  if (error || !org) throw new AppError("INTERNAL", error?.message ?? "Failed to create organization");

  const { error: memErr } = await admin.from("organization_memberships").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
    status: "active",
  });
  if (memErr) throw new AppError("INTERNAL", memErr.message);

  // Default Mon–Fri 9–17 America/Toronto
  const hours = Array.from({ length: 7 }, (_, day) => ({
    organization_id: org.id,
    day_of_week: day,
    is_open: day < 5,
    open_time: day < 5 ? "09:00" : null,
    close_time: day < 5 ? "17:00" : null,
    timezone: parsed.timezone,
  }));
  await admin.from("business_hours").insert(hours);

  await admin.from("ai_agents").insert({
    organization_id: org.id,
    name: "LocalAgent Receptionist",
    greeting: `Hi, you've reached ${parsed.name}. I'm the automated receptionist.`,
    is_active: true,
    is_primary: true,
    recording_enabled: false,
  });

  await writeAuditLog({
    organizationId: org.id,
    actorUserId: userId,
    action: "organization.created",
    entityType: "organization",
    entityId: org.id,
  });

  return org;
}

export async function updateOnboardingStep(
  organizationId: string,
  step: string,
  stepNumber: number,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ onboarding_status: step, onboarding_step: stepNumber })
    .eq("id", organizationId);
  if (error) throw new AppError("INTERNAL", error.message);
}
