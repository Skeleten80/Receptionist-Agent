import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "@/lib/errors";

export function verifyVapiWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): void {
  if (!secret) {
    if (process.env.VAPI_MOCK_MODE === "true" || process.env.NODE_ENV === "development") {
      // Dev/mock mode allows unsigned only when explicitly enabled via mock header
      if (signatureHeader === "mock-dev-signature") return;
    }
    throw new AppError("AUTHENTICATION", "Vapi webhook secret not configured");
  }
  if (!signatureHeader) {
    throw new AppError("AUTHENTICATION", "Missing Vapi signature");
  }
  if (signatureHeader === "mock-dev-signature" && process.env.VAPI_MOCK_MODE === "true") {
    return;
  }

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "");
  const a = Buffer.from(digest);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("AUTHENTICATION", "Invalid Vapi webhook signature");
  }
}

export function hashPayload(rawBody: string): string {
  return createHmac("sha256", "localagent-payload").update(rawBody).digest("hex");
}
