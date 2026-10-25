import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/server/same-origin";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("unicircle_session")?.value;
  if (!token) {
    return NextResponse.json(
      { error: { message: "Please sign in." } },
      { status: 401 },
    );
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: { message: "Request origin is not allowed." } },
      { status: 403 },
    );
  }
  const expected = request.cookies.get("unicircle_csrf")?.value;
  const supplied = request.headers.get("x-csrf-token");
  if (!expected || !supplied) {
    return NextResponse.json(
      { error: { message: "Session expired." } },
      { status: 401 },
    );
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json(
      { error: { message: "Security check failed." } },
      { status: 403 },
    );
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json(
      { error: { message: "JSON is required." } },
      { status: 415 },
    );
  }
  const body = await request.text();
  if (body.length > 2_000) {
    return NextResponse.json(
      { error: { message: "Request is too large." } },
      { status: 413 },
    );
  }
  try {
    const backendBase = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
    const response = await fetch(new URL("/api/v1/assistant/ask", backendBase), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
    const result = await response.json().catch(() => null);
    if (!result) {
      return NextResponse.json(
        { error: { message: "Invalid backend response." } },
        { status: 502 },
      );
    }
    return NextResponse.json(result, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Campus assistant service is temporarily unavailable." } },
      { status: 503 },
    );
  }
}
