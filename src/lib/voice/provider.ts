import type { AssistantConfig, UpsertAssistantResult, VoiceProvider } from "@/lib/voice/types";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logging";

async function withBackoff<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = Math.min(2000, 200 * 2 ** i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export class VapiProvider implements VoiceProvider {
  readonly name = "vapi" as const;

  constructor(private readonly apiKey: string) {}

  async upsertAssistant(
    config: AssistantConfig,
    existingId?: string | null,
  ): Promise<UpsertAssistantResult> {
    if (!this.apiKey) {
      throw new AppError("PROVIDER", "VAPI_API_KEY is not configured");
    }

    const body = {
      name: config.name,
      firstMessage: config.greeting,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: config.systemPrompt }],
      },
      voice: config.voiceId ? { voiceId: config.voiceId } : undefined,
      metadata: config.metadata ?? {},
      recordingEnabled: config.recordingEnabled,
    };

    return withBackoff(async () => {
      const url = existingId
        ? `https://api.vapi.ai/assistant/${existingId}`
        : "https://api.vapi.ai/assistant";
      const method = existingId ? "PATCH" : "POST";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text();
          log("error", "vapi_assistant_upsert_failed", { status: res.status, body: text.slice(0, 200) });
          throw new AppError("PROVIDER", `Vapi assistant upsert failed (${res.status})`);
        }
        const json = (await res.json()) as { id: string };
        return { providerAssistantId: json.id, raw: json };
      } finally {
        clearTimeout(timer);
      }
    });
  }
}

export class MockVoiceProvider implements VoiceProvider {
  readonly name = "mock" as const;

  async upsertAssistant(
    config: AssistantConfig,
    existingId?: string | null,
  ): Promise<UpsertAssistantResult> {
    return {
      providerAssistantId: existingId ?? `mock_asst_${crypto.randomUUID().slice(0, 8)}`,
      raw: { mock: true, name: config.name },
    };
  }

  async initiateTestCall(_input: { assistantId: string; toNumber: string }) {
    return { callId: `mock_call_${crypto.randomUUID().slice(0, 8)}` };
  }
}

export function getVoiceProvider(): VoiceProvider {
  if (process.env.VAPI_MOCK_MODE === "true" || !process.env.VAPI_API_KEY) {
    return new MockVoiceProvider();
  }
  return new VapiProvider(process.env.VAPI_API_KEY);
}
