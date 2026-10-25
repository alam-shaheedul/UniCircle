import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/server/same-origin";

type Context = { params: Promise<{ path: string[] }> };

const uuid = "[0-9a-fA-F-]{36}";
const club = "[a-z0-9]+(?:-[a-z0-9]+)*";
const allowed: Record<string, RegExp[]> = {
  GET: [
    /^clubs$/,
    /^events$/,
    /^clubs\/requests\/mine$/,
    /^admin\/club-requests$/,
    /^notifications\/me$/,
    new RegExp(`^clubs/${club}$`),
    new RegExp(`^clubs/${club}/membership-requests$`),
  ],
  POST: [
    /^clubs\/requests$/,
    new RegExp(`^admin/club-requests/${uuid}/review$`),
    new RegExp(`^clubs/${club}/admins$`),
    new RegExp(`^clubs/${club}/events$`),
    new RegExp(`^clubs/${club}/membership-requests$`),
    new RegExp(`^clubs/${club}/membership-requests/${uuid}/approve$`),
    new RegExp(`^events/${uuid}/registrations$`),
  ],
  PUT: [
    new RegExp(`^clubs/${club}$`),
    new RegExp(`^events/${uuid}$`),
    new RegExp(`^events/${uuid}/interest$`),
    /^notifications\/read-all$/,
    new RegExp(`^notifications/${uuid}/read$`),
    new RegExp(`^clubs/${club}/membership-settings$`),
  ],
  DELETE: [
    new RegExp(`^clubs/${club}/admins/${uuid}$`),
    new RegExp(`^events/${uuid}$`),
    new RegExp(`^clubs/${club}/membership-requests/${uuid}$`),
  ],
};

async function proxy(request: NextRequest, context: Context) {
  const token = request.cookies.get("unicircle_session")?.value;
  if (!token) {
    return NextResponse.json(
      { error: { message: "Please sign in." } },
      { status: 401 },
    );
  }
  const path = (await context.params).path.join("/");
  if (!allowed[request.method]?.some((pattern) => pattern.test(path))) {
    return NextResponse.json({ error: { message: "Not found." } }, { status: 404 });
  }
  const mutation = request.method !== "GET";
  if (mutation) {
    if (!isSameOrigin(request)) {
      return NextResponse.json(
        { error: { message: "Request origin is not allowed." } },
        { status: 403 },
      );
    }
    const csrf = request.cookies.get("unicircle_csrf")?.value;
    const supplied = request.headers.get("x-csrf-token");
    if (!csrf || !supplied) {
      return NextResponse.json(
        { error: { message: "Session expired." } },
        { status: 401 },
      );
    }
    const expected = Buffer.from(csrf);
    const received = Buffer.from(supplied);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return NextResponse.json(
        { error: { message: "Security check failed." } },
        { status: 403 },
      );
    }
  }
  if (
    mutation &&
    request.method !== "DELETE" &&
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: { message: "JSON is required." } },
      { status: 415 },
    );
  }
  const body =
    mutation && request.method !== "DELETE" ? await request.text() : undefined;
  if (body && body.length > 16_384) {
    return NextResponse.json(
      { error: { message: "Request is too large." } },
      { status: 413 },
    );
  }
  try {
    const backendBase = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
    const target = new URL(`/api/v1/${path}`, backendBase);
    if (request.method === "GET") target.search = request.nextUrl.search;
    const response = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 204) return new NextResponse(null, { status: 204 });
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
      { error: { message: "Club service is temporarily unavailable." } },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
