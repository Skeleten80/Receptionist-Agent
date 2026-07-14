import { z } from "zod";

export const voiceToolNames = [
  "get_business_hours",
  "get_service_information",
  "check_appointment_availability",
  "book_appointment",
  "create_or_update_customer",
  "create_lead",
  "transfer_call",
  "send_follow_up_message",
  "mark_call_urgent",
] as const;

export type VoiceToolName = (typeof voiceToolNames)[number];

export const createOrUpdateCustomerToolSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone_e164: z.string().min(8),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createLeadToolSchema = z.object({
  customer_phone_e164: z.string().min(8),
  service_name: z.string().optional().nullable(),
  job_description: z.string().optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  preferred_date: z.string().optional().nullable(),
  preferred_time_window: z.string().optional().nullable(),
});

export function getVapiToolDefinitions() {
  return voiceToolNames.map((name) => ({
    type: "function" as const,
    function: {
      name,
      description: `LocalAgent tool: ${name}`,
      parameters: { type: "object", additionalProperties: true },
    },
  }));
}
