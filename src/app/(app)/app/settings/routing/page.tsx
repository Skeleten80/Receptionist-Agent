import { Card, CardTitle } from "@/components/ui/card";

export default function RoutingSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Call routing</h1>
      <Card>
        <CardTitle>Transfer rules</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Configure transfer phone and conditions on the AI Receptionist page. Emergency callers are instructed to dial
          911 for immediate danger.
        </p>
      </Card>
    </div>
  );
}
