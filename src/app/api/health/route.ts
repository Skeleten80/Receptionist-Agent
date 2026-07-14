import { NextResponse } from "next/server";
import { hasSupabaseServiceConfig } from "@/lib/supabase/admin";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "localagent",
    databaseConfigured: hasSupabaseServiceConfig(),
    vapiMockMode: process.env.VAPI_MOCK_MODE === "true",
    timestamp: new Date().toISOString(),
  });
}
