import { structuredCallResultSchema, type StructuredCallResult } from "@/lib/validation/schemas";
import type { NormalizedCallEvent } from "@/lib/voice/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function normalizeVapiWebhook(payload: unknown): NormalizedCallEvent {
  const root = asRecord(payload);
  const message = asRecord(root.message ?? root);
  const call = asRecord(message.call ?? root.call ?? root);
  const artifact = asRecord(message.artifact ?? call.artifact ?? {});
  const analysis = asRecord(message.analysis ?? artifact.analysis ?? {});

  const providerCallId = String(call.id ?? root.callId ?? root.provider_call_id ?? "");
  const eventType = String(message.type ?? root.type ?? root.event_type ?? "unknown");
  const providerEventId = String(
    root.id ?? message.id ?? `${providerCallId}:${eventType}:${root.timestamp ?? "0"}`,
  );

  let structured: StructuredCallResult | null = null;
  const structuredRaw = analysis.structuredData ?? root.structured_result ?? message.structuredData;
  if (structuredRaw) {
    const parsed = structuredCallResultSchema.safeParse(structuredRaw);
    structured = parsed.success ? parsed.data : null;
  }

  const orgId =
    (asRecord(call.metadata).organizationId as string | undefined) ??
    (asRecord(root.metadata).organizationId as string | undefined) ??
    (root.organization_id as string | undefined) ??
    null;

  const duration =
    typeof call.durationSeconds === "number"
      ? call.durationSeconds
      : typeof message.durationSeconds === "number"
        ? message.durationSeconds
        : null;

  return {
    provider: "vapi",
    providerEventId,
    eventType,
    providerCallId,
    organizationId: orgId,
    assistantId: (call.assistantId as string) ?? null,
    callerPhone:
      (asRecord(call.customer).number as string) ??
      (call.customerNumber as string) ??
      (root.caller_phone as string) ??
      null,
    destinationPhone:
      (asRecord(call.phoneNumber).number as string) ?? (root.destination_phone as string) ?? null,
    status: String(call.status ?? message.status ?? "completed"),
    startedAt: (call.startedAt as string) ?? null,
    endedAt: (call.endedAt as string) ?? null,
    durationSeconds: duration,
    recordingUrl: (artifact.recordingUrl as string) ?? (call.recordingUrl as string) ?? null,
    transcript: (artifact.transcript as string) ?? (message.transcript as string) ?? null,
    summary: (analysis.summary as string) ?? (message.summary as string) ?? null,
    costCents:
      typeof call.cost === "number" ? Math.round(call.cost * 100) : (root.cost_cents as number) ?? null,
    structured,
    raw: payload,
  };
}
