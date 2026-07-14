import { Card, CardTitle } from "@/components/ui/card";

export default function CalendarSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendar</h1>
      <Card>
        <CardTitle>Booking mode</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Google Calendar OAuth requires GOOGLE_OAUTH_CLIENT_ID/SECRET (see docs/GOOGLE_CALENDAR_SETUP.md). Without
          credentials, LocalAgent uses <strong>manual request mode</strong>: preferred windows are saved as pending
          appointments and never claimed as confirmed.
        </p>
        <p className="mt-3 text-sm">Current mode: Manual request (default until Google is connected).</p>
      </Card>
    </div>
  );
}
