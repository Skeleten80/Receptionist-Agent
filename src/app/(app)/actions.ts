"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrganization } from "@/lib/organizations";
import {
  createOrganizationSchema,
  faqInputSchema,
  serviceInputSchema,
  receptionistConfigSchema,
  manualAppointmentSchema,
  updateLeadStatusSchema,
} from "@/lib/validation/schemas";
import { requireOrgMembership, requireUser } from "@/lib/auth";
import { buildReceptionistSystemPrompt } from "@/lib/voice/prompt-builder";
import { getVoiceProvider } from "@/lib/voice/provider";
import { createServiceClient } from "@/lib/supabase/admin";
import { createManualAppointmentRequest } from "@/lib/appointments";
import { updateLeadStatus } from "@/lib/leads";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/billing/stripe";
import { getStripePriceId, type PlanId } from "@/lib/billing/plans";
import { AppError } from "@/lib/errors";

export async function registerAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw new AppError("VALIDATION", error.message);
  redirect("/app/onboarding");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AppError("AUTHENTICATION", error.message);
  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createOrganizationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = createOrganizationSchema.parse({
    name: formData.get("name"),
    industry: formData.get("industry"),
    timezone: formData.get("timezone") || "America/Toronto",
    city: formData.get("city") || undefined,
    province: formData.get("province") || "ON",
  });
  const org = await createOrganization(user.userId, parsed);
  redirect(`/app/onboarding?org=${org.id}`);
}

export async function addServiceAction(organizationId: string, formData: FormData): Promise<void> {
  await requireOrgMembership(organizationId, { role: "owner" });
  const parsed = serviceInputSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    duration_minutes: formData.get("duration_minutes") || 60,
  });
  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    organization_id: organizationId,
    ...parsed,
  });
  if (error) throw new AppError("INTERNAL", error.message);
  redirect("/app/settings/services");
}

export async function addFaqAction(organizationId: string, formData: FormData): Promise<void> {
  await requireOrgMembership(organizationId, { role: "owner" });
  const parsed = faqInputSchema.parse({
    question: formData.get("question"),
    answer: formData.get("answer"),
    category: formData.get("category") || undefined,
  });
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").insert({
    organization_id: organizationId,
    ...parsed,
  });
  if (error) throw new AppError("INTERNAL", error.message);
  redirect("/app/settings/faqs");
}

export async function saveReceptionistAction(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  await requireOrgMembership(organizationId, { role: "owner" });
  const parsed = receptionistConfigSchema.parse({
    name: formData.get("name"),
    greeting: formData.get("greeting"),
    transfer_phone: formData.get("transfer_phone") || null,
    transfer_enabled: formData.get("transfer_enabled") === "on",
    recording_enabled: formData.get("recording_enabled") === "on",
    tone: formData.get("tone") || "warm_professional",
    voice_id: formData.get("voice_id") || null,
  });

  const admin = createServiceClient();
  const [{ data: org }, { data: hours }, { data: services }, { data: faqs }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", organizationId).single(),
    admin.from("business_hours").select("*").eq("organization_id", organizationId),
    admin.from("services").select("*").eq("organization_id", organizationId).eq("is_active", true),
    admin.from("faqs").select("*").eq("organization_id", organizationId).eq("is_active", true),
  ]);

  if (!org) throw new AppError("NOT_FOUND", "Organization not found");

  const systemPrompt = buildReceptionistSystemPrompt({
    businessName: org.name,
    businessDescription: org.description,
    serviceArea: org.service_area,
    city: org.city,
    province: org.province,
    timezone: org.timezone,
    hours: hours ?? [],
    services: services ?? [],
    faqs: faqs ?? [],
    bookingPolicy:
      "Confirm details aloud. Prefer configured services only. Use Google Calendar when connected; otherwise create a pending manual appointment request and never claim confirmation.",
    transferPolicy:
      "Transfer when the caller asks for a person, when urgency is high, when the request is outside configured knowledge, or when safety concerns arise.",
    transferPhone: parsed.transfer_phone,
    recordingEnabled: parsed.recording_enabled,
    recordingDisclosure: org.recording_disclosure,
    emergencyLimitations:
      "For immediate danger (fire, medical emergency, active gas leak with symptoms), instruct the caller to dial 911. Do not claim on-site emergency response capability.",
  });

  const provider = getVoiceProvider();
  const { data: existing } = await admin
    .from("ai_agents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .maybeSingle();

  const upserted = await provider.upsertAssistant(
    {
      name: parsed.name,
      greeting: parsed.greeting,
      systemPrompt,
      voiceId: parsed.voice_id,
      transferPhone: parsed.transfer_phone,
      transferEnabled: parsed.transfer_enabled,
      recordingEnabled: parsed.recording_enabled,
      metadata: { organizationId },
    },
    existing?.provider_assistant_id,
  );

  await admin.from("ai_agents").upsert({
    id: existing?.id,
    organization_id: organizationId,
    name: parsed.name,
    greeting: parsed.greeting,
    system_prompt: systemPrompt,
    transfer_phone: parsed.transfer_phone,
    transfer_enabled: parsed.transfer_enabled,
    recording_enabled: parsed.recording_enabled,
    tone: parsed.tone,
    voice_id: parsed.voice_id,
    provider: provider.name,
    provider_assistant_id: upserted.providerAssistantId,
    is_active: true,
    is_primary: true,
  });

  await admin
    .from("organizations")
    .update({
      onboarding_status: "receptionist",
      onboarding_step: 5,
      recording_enabled: parsed.recording_enabled,
    })
    .eq("id", organizationId);

  redirect("/app/receptionist");
}

export async function createManualAppointmentAction(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  const auth = await requireOrgMembership(organizationId);
  const parsed = manualAppointmentSchema.parse({
    preferred_date: formData.get("preferred_date"),
    preferred_time_window: formData.get("preferred_time_window"),
    customer_notes: formData.get("customer_notes") || undefined,
    caller_name: formData.get("caller_name") || undefined,
    caller_phone: formData.get("caller_phone") || undefined,
    lead_id: formData.get("lead_id") || undefined,
  });
  await createManualAppointmentRequest(organizationId, auth.userId, parsed);
  redirect("/app/appointments");
}

export async function updateLeadStatusAction(
  organizationId: string,
  leadId: string,
  formData: FormData,
): Promise<void> {
  const auth = await requireOrgMembership(organizationId);
  const parsed = updateLeadStatusSchema.parse({
    status: formData.get("status"),
    internal_notes: formData.get("internal_notes") || undefined,
  });
  await updateLeadStatus(organizationId, leadId, parsed, auth.userId);
  redirect(`/app/leads/${leadId}`);
}

export async function startCheckoutAction(organizationId: string, planId: PlanId): Promise<void> {
  const auth = await requireOrgMembership(organizationId, { role: "owner" });
  const admin = createServiceClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!process.env.STRIPE_SECRET_KEY || !getStripePriceId(planId)) {
    throw new AppError(
      "PROVIDER",
      "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* in the environment. See docs/STRIPE_SETUP.md.",
    );
  }

  const session = await createCheckoutSession({
    organizationId,
    planId,
    customerEmail: auth.email ?? "owner@example.com",
    stripeCustomerId: sub?.stripe_customer_id,
  });
  if (!session.url) throw new AppError("PROVIDER", "Stripe did not return a checkout URL");
  redirect(session.url);
}

export async function openBillingPortalAction(organizationId: string): Promise<void> {
  await requireOrgMembership(organizationId, { role: "owner" });
  const admin = createServiceClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    throw new AppError("VALIDATION", "No Stripe customer on file yet.");
  }
  const session = await createBillingPortalSession(sub.stripe_customer_id);
  redirect(session.url);
}
