import type { StructuredCallResult } from "@/lib/validation/schemas";

export type VoiceProviderName = "vapi" | "mock";

export type AssistantConfig = {
  name: string;
  systemPrompt: string;
  greeting: string;
  voiceId?: string | null;
  transferPhone?: string | null;
  transferEnabled: boolean;
  recordingEnabled: boolean;
  metadata?: Record<string, string>;
};

export type UpsertAssistantResult = {
  providerAssistantId: string;
  raw?: unknown;
};

export type NormalizedCallEvent = {
  provider: VoiceProviderName;
  providerEventId: string;
  eventType: string;
  providerCallId: string;
  organizationId?: string | null;
  assistantId?: string | null;
  callerPhone?: string | null;
  destinationPhone?: string | null;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  transcript?: string | null;
  summary?: string | null;
  costCents?: number | null;
  structured?: StructuredCallResult | null;
  raw: unknown;
};

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  upsertAssistant(config: AssistantConfig, existingId?: string | null): Promise<UpsertAssistantResult>;
  initiateTestCall?(input: { assistantId: string; toNumber: string }): Promise<{ callId: string }>;
}
