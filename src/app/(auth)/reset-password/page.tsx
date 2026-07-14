"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (err) setError(err.message);
      else setMessage("If that email exists, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email. Check Supabase configuration.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardTitle>Reset password</CardTitle>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input name="email" type="email" required placeholder="you@business.com" />
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
        {message && <p className="mt-3 text-sm text-teal-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-4 text-sm">
          <Link href="/login" className="text-teal-700 underline">
            Back to login
          </Link>
        </p>
      </Card>
    </div>
  );
}
