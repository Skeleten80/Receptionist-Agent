/**
 * Development seed — fictional HVAC organization.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Never run automatically in production.
 *
 * Usage: npm run db:seed
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed production");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env for seed");

  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Create auth users via admin API
  const ownerEmail = "owner.demo@localagent.test";
  const memberEmail = "member.demo@localagent.test";
  const password = "DemoPass123!";

  async function ensureUser(email: string, fullName: string) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed.data.users.find((u) => u.email === email);
    if (existing) return existing.id;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error("user create failed");
    return created.data.user.id;
  }

  const ownerId = await ensureUser(ownerEmail, "Demo Owner");
  const memberId = await ensureUser(memberEmail, "Demo Member");

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .upsert(
      {
        name: "Demo Stratford Comfort Heating & Air",
        slug: "demo-stratford-comfort",
        industry: "HVAC",
        timezone: "America/Toronto",
        city: "Stratford",
        province: "ON",
        country: "CA",
        service_area: "Stratford and Perth County (FICTIONAL DEMO)",
        description: "Fictional demo HVAC company for LocalAgent development.",
        onboarding_status: "active",
        subscription_status: "trialing",
      },
      { onConflict: "slug" },
    )
    .select("*")
    .single();
  if (orgErr) throw orgErr;

  await admin.from("organization_memberships").upsert(
    [
      { organization_id: org.id, user_id: ownerId, role: "owner", status: "active" },
      { organization_id: org.id, user_id: memberId, role: "member", status: "active" },
    ],
    { onConflict: "organization_id,user_id" },
  );

  for (let day = 0; day < 7; day++) {
    await admin.from("business_hours").upsert(
      {
        organization_id: org.id,
        day_of_week: day,
        is_open: day < 5,
        open_time: day < 5 ? "08:00" : null,
        close_time: day < 5 ? "17:00" : null,
        timezone: "America/Toronto",
      },
      { onConflict: "organization_id,day_of_week" },
    );
  }

  await admin.from("services").delete().eq("organization_id", org.id);
  await admin.from("services").insert([
    { organization_id: org.id, name: "AC Repair", duration_minutes: 90, description: "Cooling repair visit" },
    { organization_id: org.id, name: "Furnace Repair", duration_minutes: 90, description: "Heating repair visit" },
    { organization_id: org.id, name: "Maintenance", duration_minutes: 60, description: "Seasonal maintenance" },
  ]);

  await admin.from("faqs").delete().eq("organization_id", org.id);
  await admin.from("faqs").insert([
    {
      organization_id: org.id,
      question: "What areas do you serve?",
      answer: "Stratford and Perth County.",
      category: "service_area",
    },
    {
      organization_id: org.id,
      question: "What are your hours?",
      answer: "Monday to Friday, 8am to 5pm.",
      category: "hours",
    },
    {
      organization_id: org.id,
      question: "Do you offer maintenance plans?",
      answer: "Yes, we book seasonal maintenance appointments.",
      category: "services",
    },
  ]);

  console.log("Seeded fictional demo org:", org.id);
  console.log("Owner login:", ownerEmail, password);
  console.log("Member login:", memberEmail, password);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
