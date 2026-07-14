import { createServiceClient, hasSupabaseServiceConfig } from "@/lib/supabase/admin";
import { log } from "@/lib/logging";

export async function writeAuditLog(input: {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  if (!hasSupabaseServiceConfig()) {
    log("info", "audit_log_skipped_no_db", { action: input.action });
    return;
  }
  const admin = createServiceClient();
  const { error } = await admin.from("audit_logs").insert({
    organization_id: input.organizationId ?? null,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata_json: input.metadata ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });
  if (error) log("warn", "audit_log_failed", { error: error.message, action: input.action });
}
