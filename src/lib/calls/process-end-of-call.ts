import { createServiceClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";
import { log } from "@/lib/logging";
import { normalizePhoneE164 } from "@/lib/utils";
import type { NormalizedCallEvent } from "@/lib/voice/types";
import { structuredCallResultSchema } from "@/lib/validation/schemas";

export async function persistWebhookEvent(input: {
  provider: string;
  providerEventId: string;
  eventType: string;
  organizationId?: string | null;
  payloadHash: string;
}) {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("webhook_events")
    .upsert(
      {
        provider: input.provider,
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        organization_id: input.organizationId ?? null,
        payload_hash: input.payloadHash,
        processing_status: "received",
        attempts: 1,
      },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();

  if (error) {
    // Unique conflict → already processed/received
    const existing = await admin
      .from("webhook_events")
      .select("*")
      .eq("provider", input.provider)
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();
    return { event: existing.data, duplicate: true as const };
  }
  return { event: data, duplicate: false as const };
}

export async function markWebhookProcessed(id: string, status: "processed" | "failed" | "ignored", lastError?: string) {
  const admin = createServiceClient();
  await admin
    .from("webhook_events")
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
      last_error: lastError ?? null,
    })
    .eq("id", id);
}

export async function processEndOfCallEvent(event: NormalizedCallEvent) {
  if (!event.providerCallId) {
    throw new Error("Missing provider call id");
  }

  const admin = createServiceClient();
  let organizationId = event.organizationId ?? null;

  if (!organizationId && event.assistantId) {
    const { data: agent } = await admin
      .from("ai_agents")
      .select("organization_id")
      .eq("provider_assistant_id", event.assistantId)
      .maybeSingle();
    organizationId = agent?.organization_id ?? null;
  }

  if (!organizationId) {
    throw new Error("Unable to resolve organization for call");
  }

  const structured = event.structured
    ? structuredCallResultSchema.parse(event.structured)
    : structuredCallResultSchema.parse({
        caller_phone: event.callerPhone,
        summary: event.summary,
        outcome: event.status,
      });

  const phone =
    normalizePhoneE164(structured.caller_phone || event.callerPhone || "") ||
    event.callerPhone ||
    null;

  let customerId: string | null = null;
  if (phone) {
    const { data: existing } = await admin
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone_e164", phone)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
      await admin
        .from("customers")
        .update({
          first_name: structured.caller_name?.split(" ")[0] ?? undefined,
          email: structured.caller_email || undefined,
          address: structured.address || undefined,
        })
        .eq("id", existing.id);
    } else {
      const nameParts = (structured.caller_name || "").split(" ");
      const { data: created, error } = await admin
        .from("customers")
        .insert({
          organization_id: organizationId,
          first_name: nameParts[0] || null,
          last_name: nameParts.slice(1).join(" ") || null,
          phone_e164: phone,
          email: structured.caller_email || null,
          address: structured.address || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      customerId = created.id;
    }
  }

  const { data: callRow, error: callErr } = await admin
    .from("calls")
    .upsert(
      {
        organization_id: organizationId,
        customer_id: customerId,
        provider: event.provider,
        provider_call_id: event.providerCallId,
        direction: "inbound",
        caller_phone_e164: phone,
        destination_phone_e164: event.destinationPhone,
        status: event.status,
        started_at: event.startedAt,
        ended_at: event.endedAt,
        duration_seconds: event.durationSeconds,
        recording_url: event.recordingUrl,
        transcript: event.transcript,
        summary: structured.summary || event.summary,
        sentiment: structured.sentiment,
        outcome: structured.outcome,
        transfer_status: structured.transfer_completed
          ? "completed"
          : structured.transfer_requested
            ? "requested"
            : null,
        consent_recorded: true,
        structured_result: structured,
        estimated_provider_cost_cents: event.costCents,
        raw_provider_payload: event.raw,
      },
      { onConflict: "provider,provider_call_id" },
    )
    .select("*")
    .single();

  if (callErr) throw callErr;

  let serviceId: string | null = null;
  if (structured.service_requested) {
    const { data: svc } = await admin
      .from("services")
      .select("id")
      .eq("organization_id", organizationId)
      .ilike("name", structured.service_requested)
      .maybeSingle();
    serviceId = svc?.id ?? null;
  }

  const priority =
    structured.urgency === "urgent" || structured.urgency === "high"
      ? structured.urgency
      : "normal";

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      call_id: callRow.id,
      service_id: serviceId,
      source: "phone",
      status: structured.appointment_booked
        ? "booked"
        : structured.qualification_status === "qualified"
          ? "qualified"
          : "new",
      priority,
      job_description: structured.job_description || structured.reason_for_call,
      requested_date: structured.preferred_date || null,
      requested_time_window: structured.preferred_time_window || null,
    })
    .select("*")
    .single();

  if (leadErr) throw leadErr;

  if (event.durationSeconds) {
    await admin.from("usage_records").insert({
      organization_id: organizationId,
      call_id: callRow.id,
      usage_type: "call_minutes",
      quantity: Math.ceil(event.durationSeconds / 60),
      unit: "minutes",
      cost_cents: event.costCents,
      occurred_at: event.endedAt ?? new Date().toISOString(),
    });
  }

  await writeAuditLog({
    organizationId,
    action: "call.end_of_call_processed",
    entityType: "call",
    entityId: callRow.id,
    metadata: { leadId: lead.id, providerCallId: event.providerCallId },
  });

  log("info", "end_of_call_processed", {
    organizationId,
    callId: callRow.id,
    leadId: lead.id,
  });

  return { call: callRow, lead, customerId, organizationId };
}
