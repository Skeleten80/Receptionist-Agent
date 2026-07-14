import { Card, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <Card>
        <CardTitle>Plan-gated analytics</CardTitle>
        <p className="mt-2 text-sm text-slate-600">
          Advanced analytics are available on Growth and Pro. Dashboard metrics remain available on all plans and use
          real aggregates only — never invented values.
        </p>
      </Card>
    </div>
  );
}
