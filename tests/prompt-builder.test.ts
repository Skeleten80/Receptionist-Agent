import { describe, expect, it } from "vitest";
import { buildReceptionistSystemPrompt } from "@/lib/voice/prompt-builder";

describe("prompt builder", () => {
  it("includes business name, AI disclosure rules, and configured services", () => {
    const prompt = buildReceptionistSystemPrompt({
      businessName: "Stratford Comfort Heating & Air",
      timezone: "America/Toronto",
      city: "Stratford",
      province: "ON",
      hours: [{ day_of_week: 0, is_open: true, open_time: "08:00", close_time: "17:00" }],
      services: [{ name: "AC Repair", duration_minutes: 90, description: "Cooling repair" }],
      faqs: [{ question: "What areas do you serve?", answer: "Stratford and Perth County." }],
      bookingPolicy: "Confirm aloud.",
      transferPolicy: "Transfer on request.",
      recordingEnabled: true,
      recordingDisclosure: "This call may be recorded.",
      emergencyLimitations: "Dial 911 for immediate danger.",
    });

    expect(prompt).toContain("Stratford Comfort Heating & Air");
    expect(prompt).toContain("never claim to be a human");
    expect(prompt).toContain("AC Repair");
    expect(prompt).toContain("This call may be recorded.");
    expect(prompt).toContain("911");
  });
});
