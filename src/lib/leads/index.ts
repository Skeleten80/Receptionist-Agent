import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { requireOrgMembership } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { updateLeadStatusSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export async function listLeads(organizationId: string) {
  await requireOrgMembership(organizationId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, customers(first_name,last_name,phone_e164), services(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new AppError("INTERNAL", error.message);
  return data ?? [];
}

export async function updateLeadStatus(
  organizationId: string,
  leadId: string,
  input: z.infer<typeof updateLeadStatusSchema>,
  actorUserId: string,
) {
  await requireOrgMembership(organizationId);
  const parsed = updateLeadStatusSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({
      status: parsed.status,
      internal_notes: parsed.internal_notes,
    })
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error || !data) throw new AppError("NOT_FOUND", "Lead not found");

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: "lead.status_updated",
    entityType: "lead",
    entityId: leadId,
    metadata: { status: parsed.status },
  });
  return data;
}
