"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/calls", label: "Calls" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/customers", label: "Customers" },
  { href: "/app/receptionist", label: "AI Receptionist" },
  { href: "/app/analytics", label: "Analytics" },
  { href: "/app/settings", label: "Settings" },
];

export function AppShell({ children, orgName }: { children: ReactNode; orgName?: string }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="text-lg font-semibold tracking-tight text-teal-800 dark:text-teal-300">LocalAgent</div>
          <div className="mt-1 truncate text-xs text-slate-500">{orgName ?? "Select organization"}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-teal-700 text-white"
                    : "text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-900",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
