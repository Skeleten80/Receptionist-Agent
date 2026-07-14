import Link from "next/link";
import { loginAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardTitle>Log in to LocalAgent</CardTitle>
        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          No account? <Link href="/register" className="text-teal-700 underline">Start trial</Link>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <Link href="/reset-password" className="text-teal-700 underline">Reset password</Link>
        </p>
      </Card>
    </div>
  );
}
