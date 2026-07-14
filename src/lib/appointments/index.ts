import { AppError } from "@/lib/errors";
import { requireOrgMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { manualAppointmentSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export type AppointmentMode = "google" | "manual";

export async function createManualAppointmentRequest(
  organizationId: string,
  actorUserId: string,
  input: z.infer<typeof manualAppointmentSchema>,
) {
  await requireOrgMembership(organizationId);
  const parsed = manualAppointmentSchema.parse(input);
  const supabase = await createClient();

  let customerId = parsed.customer_id ?? null;
  if (!customerId && parsed.caller_phone) {
    const admin = createServiceClient();
    const { data: customer } = await admin
      .from("customers")
      .upsert(
        {
          organization_id: organizationId,
          phone_e164: parsed.caller_phone,
          first_name: parsed.caller_name ?? null,
        },
        { onConflict: "organization_id,phone_e164" },
      )
      .select("id")
      .single();
    customerId = customer?.id ?? null;
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      lead_id: parsed.lead_id ?? null,
      service_id: parsed.service_id ?? null,
      status: "pending",
      preferred_date: parsed.preferred_date,
      preferred_time_window: parsed.preferred_time_window,
      customer_notes: parsed.customer_notes ?? null,
      timezone: "America/Toronto",
      external_calendar_provider: "manual",
    })
    .select("*")
    .single();

  if (error || !data) throw new AppError("INTERNAL", error?.message ?? "Failed to create appointment");

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: "appointment.manual_requested",
    entityType: "appointment",
    entityId: data.id,
  });

  return data;
}

export function appointmentsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
