import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";

const links = [
  ["Business profile", "/app/settings/profile"],
  ["Business hours", "/app/settings/hours"],
  ["Services", "/app/settings/services"],
  ["FAQs", "/app/settings/faqs"],
  ["Call routing", "/app/settings/routing"],
  ["Phone number", "/app/settings/phone"],
  ["Calendar", "/app/settings/calendar"],
  ["Notifications", "/app/settings/notifications"],
  ["Team", "/app/settings/team"],
  ["Billing", "/app/settings/billing"],
  ["Data & privacy", "/app/settings/privacy"],
];

export default function SettingsIndexPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {links.map(([label, href]) => (
          <Link key={href} href={href}>
            <Card className="hover:border-teal-600">
              <CardTitle>{label}</CardTitle>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
