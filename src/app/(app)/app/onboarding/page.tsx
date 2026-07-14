import { createOrganizationAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

const steps = [
  "Create account",
  "Business information",
  "Industry & timezone",
  "Business hours",
  "Services",
  "FAQs",
  "Receptionist",
  "Escalation phone",
  "Calendar mode",
  "Phone number",
  "Subscription",
  "Test call",
  "Activate",
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Onboarding</h1>
        <p className="text-sm text-slate-500">Progress is saved on your organization record. You can return later.</p>
      </div>
      <Card>
        <CardTitle>Checklist</CardTitle>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Card>
      {!params.org ? (
        <Card>
          <CardTitle>Create your organization</CardTitle>
          <form action={createOrganizationAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <Input name="name" placeholder="Business name" required />
            <Input name="industry" placeholder="Industry (e.g. HVAC)" required />
            <Input name="city" placeholder="City" defaultValue="Stratford" />
            <Input name="province" placeholder="Province" defaultValue="ON" />
            <Input name="timezone" placeholder="IANA timezone" defaultValue="America/Toronto" />
            <div className="md:col-span-2">
              <Button type="submit">Create organization</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <CardTitle>Organization ready</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            Org ID: <code>{params.org}</code>. Continue to services, FAQs, and receptionist configuration.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/app/settings/services?org=${params.org}`}>
              <Button variant="secondary">Add services</Button>
            </a>
            <a href={`/app/settings/faqs?org=${params.org}`}>
              <Button variant="secondary">Add FAQs</Button>
            </a>
            <a href={`/app/receptionist?org=${params.org}`}>
              <Button>Configure receptionist</Button>
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
