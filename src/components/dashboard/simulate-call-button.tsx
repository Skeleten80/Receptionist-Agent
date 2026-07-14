"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SimulateCallButton({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/dev/simulate-vapi-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={run} disabled={loading}>
        {loading ? "Running…" : "Simulate verified end-of-call webhook"}
      </Button>
      {result && (
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-slate-100 p-3 text-xs">{result}</pre>
      )}
    </div>
  );
}
