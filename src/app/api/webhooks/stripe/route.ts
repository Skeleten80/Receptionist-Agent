import { NextRequest, NextResponse } from "next/server";
import { getStripe, syncStripeSubscriptionFromEvent } from "@/lib/billing/stripe";
import { hashPayload } from "@/lib/voice/webhook-verification";
import { markWebhookProcessed, persistWebhookEvent } from "@/lib/calls/process-end-of-call";
import { toErrorResponse } from "@/lib/errors";
import { log } from "@/lib/logging";
import { hasSupabaseServiceConfig } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!hasSupabaseServiceConfig()) {
      return NextResponse.json({ error: { message: "Database not configured" } }, { status: 503 });
    }
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: { message: "Missing Stripe signature config" } }, { status: 401 });
    }

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    const { event: stored, duplicate } = await persistWebhookEvent({
      provider: "stripe",
      providerEventId: event.id,
      eventType: event.type,
      payloadHash: hashPayload(rawBody),
    });

    if (duplicate && stored?.processing_status === "processed") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await syncStripeSubscriptionFromEvent(event);
    if (stored?.id) await markWebhookProcessed(stored.id, "processed");
    log("info", "stripe_webhook_ok", { type: event.type, id: event.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = toErrorResponse(error);
    log("error", "stripe_webhook_failed", { error: String(error) });
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
