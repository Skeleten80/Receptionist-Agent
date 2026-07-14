import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireOrgMembership } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Development helper: posts a signed simulated end-of-call payload to the Vapi webhook.
 * Requires authentication + org membership. Disabled when NODE_ENV=production unless
 * VAPI_MOCK_MODE=true explicitly (still requires auth).
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production" && process.env.VAPI_MOCK_MODE !== "true") {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const body = (await req.json()) as {
      organizationId: string;
      callerPhone?: string;
      callerName?: string;
      serviceRequested?: string;
      summary?: string;
    };

    const limited = rateLimit(`simulate:${body.organizationId}`, 20, 60_000);
    if (!limited.allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

    await requireOrgMembership(body.organizationId, { role: "owner" });

    const providerCallId = `sim_${crypto.randomUUID()}`;
    const payload = {
      id: `evt_${providerCallId}`,
      type: "end-of-call-report",
      simulate_end_of_call: true,
      message: {
        type: "end-of-call-report",
        call: {
          id: providerCallId,
          status: "ended",
          startedAt: new Date(Date.now() - 180_000).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 180,
          customer: { number: body.callerPhone ?? "+15195550100" },
          metadata: { organizationId: body.organizationId },
        },
        analysis: {
          summary: body.summary ?? "Caller requested HVAC service.",
          structuredData: {
            caller_name: body.callerName ?? "Jordan Lee",
            caller_phone: body.callerPhone ?? "+15195550100",
            reason_for_call: "AC not cooling",
            service_requested: body.serviceRequested ?? "AC Repair",
            job_description: "Upstairs AC blowing warm air",
            urgency: "normal",
            preferred_date: new Date().toISOString().slice(0, 10),
            preferred_time_window: "morning",
            address: "45 Ontario St, Stratford",
            qualification_status: "qualified",
            appointment_requested: true,
            appointment_booked: false,
            transfer_requested: false,
            transfer_completed: false,
            follow_up_required: true,
            summary: body.summary ?? "Qualified AC repair lead in Stratford.",
            sentiment: "neutral",
            outcome: "lead_captured",
          },
        },
        artifact: {
          transcript: "Assistant: Hi... Caller: My AC is not cooling.",
        },
      },
    };

    const raw = JSON.stringify(payload);
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    const signature = secret
      ? createHmac("sha256", secret).update(raw).digest("hex")
      : "mock-dev-signature";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${appUrl}/api/webhooks/vapi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-signature": signature,
      },
      body: raw,
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    const mapped = toErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
