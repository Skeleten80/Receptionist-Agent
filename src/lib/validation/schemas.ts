import { z } from "zod";

export const leadStatusSchema = z.enum([
  "new",
  "qualified",
  "booked",
  "follow_up",
  "won",
  "lost",
  "spam",
]);

export const leadPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const structuredCallResultSchema = z.object({
  caller_name: z.string().nullable().optional(),
  caller_phone: z.string().nullable().optional(),
  caller_email: z.string().email().nullable().optional().or(z.literal("")),
  reason_for_call: z.string().nullable().optional(),
  service_requested: z.string().nullable().optional(),
  job_description: z.string().nullable().optional(),
  urgency: z.string().nullable().optional(),
  preferred_date: z.string().nullable().optional(),
  preferred_time_window: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  qualification_status: z.string().nullable().optional(),
  appointment_requested: z.boolean().optional().default(false),
  appointment_booked: z.boolean().optional().default(false),
  transfer_requested: z.boolean().optional().default(false),
  transfer_completed: z.boolean().optional().default(false),
  follow_up_required: z.boolean().optional().default(false),
  summary: z.string().nullable().optional(),
  sentiment: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
});

export type StructuredCallResult = z.infer<typeof structuredCallResultSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  industry: z.string().min(2).max(80),
  timezone: z.string().min(3).default("America/Toronto"),
  city: z.string().optional(),
  province: z.string().default("ON"),
});

export const serviceInputSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  duration_minutes: z.coerce.number().int().positive().max(480).default(60),
  base_price_cents: z.coerce.number().int().nonnegative().nullable().optional(),
  requires_manual_confirmation: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const faqInputSchema = z.object({
  question: z.string().min(3).max(500),
  answer: z.string().min(3).max(4000),
  category: z.string().max(80).optional(),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().default(0),
});

export const businessHoursDaySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  open_time: z.string().nullable().optional(),
  close_time: z.string().nullable().optional(),
});

export const receptionistConfigSchema = z.object({
  name: z.string().min(2).max(80),
  greeting: z.string().min(10).max(1000),
  transfer_phone: z.string().max(32).optional().nullable(),
  transfer_enabled: z.boolean().default(true),
  recording_enabled: z.boolean().default(false),
  tone: z.string().max(40).default("warm_professional"),
  voice_id: z.string().max(80).optional().nullable(),
});

export const manualAppointmentSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  preferred_date: z.string().min(8),
  preferred_time_window: z.string().min(2).max(120),
  customer_notes: z.string().max(2000).optional(),
  caller_name: z.string().max(120).optional(),
  caller_phone: z.string().max(32).optional(),
});

export const updateLeadStatusSchema = z.object({
  status: leadStatusSchema,
  internal_notes: z.string().max(5000).optional(),
});
