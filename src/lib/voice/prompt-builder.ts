export type PromptBuilderInput = {
  businessName: string;
  businessDescription?: string | null;
  serviceArea?: string | null;
  city?: string | null;
  province?: string | null;
  timezone: string;
  hours: Array<{
    day_of_week: number;
    is_open: boolean;
    open_time?: string | null;
    close_time?: string | null;
  }>;
  services: Array<{ name: string; description?: string | null; duration_minutes: number }>;
  faqs: Array<{ question: string; answer: string }>;
  bookingPolicy: string;
  transferPolicy: string;
  transferPhone?: string | null;
  recordingEnabled: boolean;
  recordingDisclosure: string;
  emergencyLimitations: string;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function buildReceptionistSystemPrompt(input: PromptBuilderInput): string {
  const hoursLines = input.hours
    .map((h) => {
      const day = DAY_NAMES[h.day_of_week] ?? `Day ${h.day_of_week}`;
      if (!h.is_open) return `- ${day}: Closed`;
      return `- ${day}: ${h.open_time ?? "?"} – ${h.close_time ?? "?"}`;
    })
    .join("\n");

  const servicesLines = input.services
    .map((s) => `- ${s.name} (${s.duration_minutes} min)${s.description ? `: ${s.description}` : ""}`)
    .join("\n");

  const faqLines = input.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  return [
    `You are the AI phone receptionist for ${input.businessName}.`,
    "You must clearly introduce yourself as an automated AI receptionist — never claim to be a human.",
    input.businessDescription ? `Business description: ${input.businessDescription}` : null,
    `Location / service area: ${[input.city, input.province, input.serviceArea].filter(Boolean).join(", ") || "as configured"}`,
    `Timezone: ${input.timezone}`,
    "",
    "Business hours:",
    hoursLines || "- Not configured",
    "",
    "Available services (only discuss these):",
    servicesLines || "- None configured",
    "",
    "Approved FAQs (only use these answers for general questions):",
    faqLines || "- None configured",
    "",
    `Appointment-booking policy: ${input.bookingPolicy}`,
    `Transfer policy: ${input.transferPolicy}`,
    input.transferPhone ? `Transfer number when escalation is required: ${input.transferPhone}` : null,
    `Emergency limitations: ${input.emergencyLimitations}`,
    "",
    input.recordingEnabled
      ? `Recording disclosure (state early): ${input.recordingDisclosure}`
      : "Recording is disabled. Do not claim the call is recorded.",
    "Ask for consent before collecting detailed personal information (address, email, payment details).",
    "",
    "You must collect when relevant: caller name, callback number, email if offered, service needed, job description, preferred date/time window, service address, urgency.",
    "You must NOT invent pricing, availability, policies, diagnoses, or technical advice.",
    "Use only configured business information. If unsure, say you will have a team member follow up.",
    "Confirm important names, phone numbers, emails, addresses, dates, and appointment times by repeating them back.",
    "Repeat final appointment details before booking. Never promise a confirmed appointment until availability is verified by a tool.",
    "For true emergencies (fire, medical, gas leak with immediate danger), tell the caller to contact local emergency services (911 in Canada) rather than pretending the business can respond immediately.",
    "Transfer urgent or requested human calls according to transfer policy.",
    "If the caller is abusive, remain calm, set a boundary once, then end the call politely if abuse continues.",
    "End gracefully when you cannot assist.",
    "After the call, produce structured post-call fields as configured by the platform tools.",
  ]
    .filter(Boolean)
    .join("\n");
}
