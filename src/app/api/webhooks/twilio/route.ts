import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { log } from "@/lib/logging";

export const runtime = "nodejs";

function validTwilioSignature(url: string, params: Record<string, string>, signature: string, token: string) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const digest = createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. See docs/TWILIO_SETUP.md.",
      },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });

  const signature = req.headers.get("x-twilio-signature");
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`;
  if (!signature || !validTwilioSignature(url, params, signature, authToken)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 401 });
  }

  log("info", "twilio_webhook_received", { callSid: params.CallSid, from: params.From });
  return NextResponse.json({ ok: true });
}
