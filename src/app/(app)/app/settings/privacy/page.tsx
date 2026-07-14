import { Card, CardTitle } from "@/components/ui/card";

export default function PrivacySettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Data & privacy</h1>
      <Card>
        <CardTitle>Controls</CardTitle>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Recording enable/disable on the receptionist and organization profile</li>
          <li>Consent tracking on calls</li>
          <li>Configurable retention days</li>
          <li>Owner data export (CSV endpoints for leads)</li>
          <li>Deletion / anonymization workflow for customer data when permitted</li>
        </ul>
        <p className="mt-4 text-sm text-amber-800">
          LocalAgent provides configurable controls. Obtain qualified Canadian legal advice before production launch.
        </p>
      </Card>
    </div>
  );
}
