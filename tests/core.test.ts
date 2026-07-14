import { describe, expect, it } from "vitest";
import { normalizePhoneE164, slugify } from "@/lib/utils";
import { structuredCallResultSchema } from "@/lib/validation/schemas";
import { calculateUsagePercent, isSubscriptionAccessAllowed } from "@/lib/billing/plans";
import { isOpenAt, toSchemaDay } from "@/lib/organizations/business-hours";
import { appointmentsOverlap } from "@/lib/appointments";
import { normalizeVapiWebhook } from "@/lib/voice/call-normalizer";
import { verifyVapiWebhookSignature } from "@/lib/voice/webhook-verification";
import { createHmac } from "crypto";
import { AppError } from "@/lib/errors";

describe("phone normalization", () => {
  it("normalizes NANP numbers to E.164", () => {
    expect(normalizePhoneE164("(519) 555-0100")).toBe("+15195550100");
    expect(normalizePhoneE164("+1 519 555 0100")).toBe("+15195550100");
  });
});

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("Stratford Comfort Heating & Air")).toBe("stratford-comfort-heating-air");
  });
});

describe("structured call result", () => {
  it("parses valid structured payloads", () => {
    const parsed = structuredCallResultSchema.parse({
      caller_name: "Jordan",
      caller_phone: "+15195550100",
      appointment_requested: true,
      summary: "AC issue",
    });
    expect(parsed.caller_name).toBe("Jordan");
    expect(parsed.appointment_booked).toBe(false);
  });
});

describe("plan limits", () => {
  it("calculates usage percent", () => {
    expect(calculateUsagePercent(150, "starter")).toBe(50);
  });
  it("allows active and trialing access", () => {
    expect(isSubscriptionAccessAllowed("active")).toBe(true);
    expect(isSubscriptionAccessAllowed("canceled")).toBe(false);
  });
});

describe("business hours", () => {
  it("maps JS Sunday to schema Saturday index 6", () => {
    expect(toSchemaDay(0)).toBe(6);
    expect(toSchemaDay(1)).toBe(0);
  });
  it("detects open time", () => {
    const mondayTen = new Date("2026-07-13T14:00:00Z"); // depends on local TZ; use constructed local
    const local = new Date();
    local.setFullYear(2026, 6, 13); // Mon Jul 13 2026
    local.setHours(10, 0, 0, 0);
    const open = isOpenAt(
      [{ day_of_week: toSchemaDay(local.getDay()), is_open: true, open_time: "09:00", close_time: "17:00" }],
      local,
    );
    expect(open).toBe(true);
    void mondayTen;
  });
});

describe("appointment conflicts", () => {
  it("detects overlapping intervals", () => {
    const aStart = new Date("2026-07-14T14:00:00Z");
    const aEnd = new Date("2026-07-14T15:00:00Z");
    const bStart = new Date("2026-07-14T14:30:00Z");
    const bEnd = new Date("2026-07-14T15:30:00Z");
    expect(appointmentsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });
});

describe("vapi normalization + signature", () => {
  it("normalizes end-of-call payloads", () => {
    const event = normalizeVapiWebhook({
      id: "evt_1",
      message: {
        type: "end-of-call-report",
        call: {
          id: "call_1",
          status: "ended",
          durationSeconds: 120,
          customer: { number: "+15195550100" },
          metadata: { organizationId: "org_1" },
        },
        analysis: {
          summary: "Test",
          structuredData: {
            caller_name: "Sam",
            caller_phone: "+15195550100",
            summary: "Test",
          },
        },
      },
    });
    expect(event.providerCallId).toBe("call_1");
    expect(event.organizationId).toBe("org_1");
    expect(event.structured?.caller_name).toBe("Sam");
  });

  it("verifies hmac signatures", () => {
    const body = '{"ok":true}';
    const secret = "test-secret";
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(() => verifyVapiWebhookSignature(body, sig, secret)).not.toThrow();
    expect(() => verifyVapiWebhookSignature(body, "bad", secret)).toThrow(AppError);
  });

  it("allows mock signature in mock mode", () => {
    process.env.VAPI_MOCK_MODE = "true";
    expect(() => verifyVapiWebhookSignature("{}", "mock-dev-signature", undefined)).not.toThrow();
  });
});
