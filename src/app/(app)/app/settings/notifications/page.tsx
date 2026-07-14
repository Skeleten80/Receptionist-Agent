import { Card, CardTitle } from "@/components/ui/card";

export default function NotificationsSettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <Card>
        <CardTitle>Email delivery</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Resend delivers transactional email when RESEND_API_KEY is set. With EMAIL_DRY_RUN=true, sends are logged
          without external delivery. Webhook acknowledgements are never blocked on non-critical email.
        </p>
      </Card>
    </div>
  );
}
