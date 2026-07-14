import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/billing/plans";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-xl font-semibold tracking-tight text-teal-800 dark:text-teal-300">LocalAgent</div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Log in
          </Link>
          <Link href="/register">
            <Button>Start trial</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <section className="grid gap-10 py-16 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl dark:text-white">
              Never miss another customer call.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
              LocalAgent answers calls, qualifies leads and books appointments while your team is busy doing the
              work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg">Start trial</Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="secondary">
                  See how it works
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-500">Built for Ontario local service businesses. Example scenarios below — not customer testimonials.</p>
          </div>
          <Card className="bg-white/90">
            <CardTitle>Example call workflow</CardTitle>
            <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li>1. Caller reaches your LocalAgent number after hours.</li>
              <li>2. AI discloses it is automated and recording policy.</li>
              <li>3. Qualifies the job and collects contact details.</li>
              <li>4. Books an approved appointment or creates a pending request.</li>
              <li>5. Urgent calls transfer to your on-call phone.</li>
              <li>6. Dashboard shows summary, lead, and next steps.</li>
            </ol>
          </Card>
        </section>

        <section id="how-it-works" className="py-10">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Configure", "Hours, services, FAQs, transfer rules, and greeting."],
              ["Connect", "Canadian phone number + optional Google Calendar + billing."],
              ["Operate", "Review calls, update leads, and follow up from one dashboard."],
            ].map(([title, body]) => (
              <Card key={title}>
                <CardTitle>{title}</CardTitle>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-10">
          <h2 className="text-2xl font-semibold">Supported business types</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            HVAC, plumbing, electrical, roofing, landscaping, auto repair, and other appointment-driven local
            services across Ontario.
          </p>
        </section>

        <section className="py-10">
          <h2 className="text-2xl font-semibold">Pricing</h2>
          <p className="mt-2 text-sm text-slate-500">Plan features are fixed in-product. Checkout prices come from your Stripe Price IDs.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((plan) => (
              <Card key={plan.id}>
                <CardTitle>{plan.name}</CardTitle>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>
                <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <li>{plan.monthlyCallMinutes} included call minutes / month</li>
                  <li>{plan.maxPhoneNumbers} phone number(s)</li>
                  <li>{plan.maxTeamMembers} team seats</li>
                  {plan.googleCalendar && <li>Google Calendar booking</li>}
                  {plan.callTransfers && <li>Call transfers</li>}
                  {plan.dataExport && <li>Data export</li>}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section className="py-10">
          <h2 className="text-2xl font-semibold">Security & privacy</h2>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Tenant isolation with Row Level Security, server-side authorization, verified webhooks, and signed
            recording access. Privacy controls are configurable; operators must obtain Canadian legal advice before
            production use. See the in-app Privacy and Terms placeholders.
          </p>
        </section>

        <section className="py-10">
          <h2 className="text-2xl font-semibold">FAQ</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              <strong className="text-slate-900 dark:text-white">Does LocalAgent replace my receptionist?</strong> It
              covers after-hours and overflow calls with clear escalation to your team.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">Can it quote prices?</strong> No — it only uses
              configured business information and never invents pricing.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-teal-800 px-8 py-10 text-white">
          <h2 className="text-2xl font-semibold">Ready to stop missing calls?</h2>
          <p className="mt-2 text-teal-50">Start a trial and configure your AI receptionist in minutes.</p>
          <div className="mt-6">
            <Link href="/register">
              <Button className="bg-white text-teal-900 hover:bg-teal-50">Start trial</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 px-6 py-8 text-sm text-slate-500 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/subprocessors">Subprocessors</Link>
          <span>© {new Date().getFullYear()} LocalAgent</span>
        </div>
      </footer>
    </div>
  );
}
