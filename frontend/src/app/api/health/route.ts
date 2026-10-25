import { NextResponse } from "next/server";

// Check the private service binding without exposing configuration or credentials.
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const backend = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
    const response = await fetch(new URL("/health", backend), {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (!response.ok || result?.data?.status !== "ok") throw new Error();
    // Public commit metadata, not credentials. CD must verify this exact build,
    // rather than accidentally passing smoke checks against an older release.
    const candidate = process.env.VERCEL_GIT_COMMIT_SHA;
    const revision = candidate && /^[a-f0-9]{40}$/.test(candidate) ? candidate : null;
    return NextResponse.json({ status: "ok", revision }, { headers });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
}
