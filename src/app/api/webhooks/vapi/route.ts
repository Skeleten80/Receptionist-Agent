import { NextRequest, NextResponse } from "next/server";
import { hashPayload, verifyVapiWebhookSignature } from "@/lib/voice/webhook-verification";
import { normalizeVapiWebhook } from "@/lib/voice/call-normalizer";
import {
  markWebhookProcessed,
  persistWebhookEvent,
  processEndOfCallEvent,
} from "@/lib/calls/process-end-of-call";
import { toErrorResponse } from "@/lib/errors";
import { log } from "@/lib/logging";
import { hasSupabaseServiceConfig } from "@/lib/supabase/admin";
import { createCorrelationId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId();
  try {
    if (!hasSupabaseServiceConfig()) {
      return NextResponse.json(
        { error: { code: "PROVIDER", message: "Database is not configured" } },
        { status: 503 },
      );
    }

    const rawBody = await req.text();
    const signature =
      req.headers.get("x-vapi-signature") ??
      req.headers.get("x-signature") ??
      req.headers.get("vapi-signature");

    verifyVapiWebhookSignature(rawBody, signature, process.env.VAPI_WEBHOOK_SECRET);

    const payload = JSON.parse(rawBody) as unknown;
    const event = normalizeVapiWebhook(payload);
    const payloadHash = hashPayload(rawBody);

    const { event: stored, duplicate } = await persistWebhookEvent({
      provider: "vapi",
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      organizationId: event.organizationId,
      payloadHash,
    });

    if (duplicate && stored?.processing_status === "processed") {
      return NextResponse.json({ ok: true, duplicate: true, correlationId });
    }

    const endOfCall =
      event.eventType.includes("end-of-call") ||
      event.eventType.includes("endOfCall") ||
      event.eventType === "call.ended" ||
      Boolean((payload as { simulate_end_of_call?: boolean }).simulate_end_of_call);

    if (!endOfCall) {
      if (stored?.id) await markWebhookProcessed(stored.id, "ignored");
      return NextResponse.json({ ok: true, ignored: true, correlationId });
    }

    const result = await processEndOfCallEvent(event);
    if (stored?.id) await markWebhookProcessed(stored.id, "processed");

    log("info", "vapi_webhook_ok", { correlationId, callId: result.call.id });
    return NextResponse.json({
      ok: true,
      correlationId,
      callId: result.call.id,
      leadId: result.lead.id,
      organizationId: result.organizationId,
    });
  } catch (error) {
    const mapped = toErrorResponse(error);
    log("error", "vapi_webhook_failed", { correlationId, error: String(error) });
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
