import { randomBytes, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isSameOrigin } from "@/lib/server/same-origin";
import {
  resetCodeCookie,
  resetGrantCookie,
  readEmailFlowCookie,
} from "@/features/auth/lib/email-flow-cookie";

const sessionCookie = "unicircle_session";
const csrfCookie = "unicircle_csrf";
const backendBase = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
const postPaths: Record<string, string> = {
  register: "/register",
  "verify-otp": "/verify-otp",
  "resend-otp": "/resend-otp",
  login: "/login",
  "forgot-password": "/forgot-password",
  "password-reset/verify-otp": "/password-reset/verify-otp",
  "password-reset/resend-otp": "/password-reset/resend-otp",
  "reset-password": "/reset-password",
  "admin/login": "/admin/login",
  logout: "/logout",
};

type RouteContext = { params: Promise<{ action: string[] }> };

function error(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function validCsrf(request: NextRequest): boolean {
  const fromCookie = request.cookies.get(csrfCookie)?.value;
  const fromHeader = request.headers.get("x-csrf-token");
  if (!fromCookie || !fromHeader) return false;
  const a = Buffer.from(fromCookie);
  const b = Buffer.from(fromHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function callBackend(
  path: string,
  options: { method: "GET" | "POST"; body?: string; token?: string },
) {
  return fetch(new URL(`/api/v1/auth${path}`, backendBase), {
    method: options.method,
    body: options.body,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(options.method === "POST" ? 45_000 : 10_000),
  });
}

async function upstreamResponse(upstream: Response) {
  if (upstream.status === 204) {
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const body = await upstream.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return error(
      502,
      "backend_error",
      "The authentication service returned an invalid response.",
    );
  }
  return NextResponse.json(body, {
    status: upstream.status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const action = (await context.params).action.join("/");
  if (action !== "me") return error(404, "not_found", "Not found.");
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return error(401, "unauthorized", "Please sign in.");
  try {
    return upstreamResponse(await callBackend("/me", { method: "GET", token }));
  } catch {
    return error(
      503,
      "backend_unavailable",
      "Authentication is temporarily unavailable.",
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const action = (await context.params).action.join("/");
  const path = postPaths[action];
  if (!path) return error(404, "not_found", "Not found.");
  if (!isSameOrigin(request))
    return error(403, "origin_rejected", "Request origin is not allowed.");

  const token = request.cookies.get(sessionCookie)?.value;
  if (action === "logout") {
    if (!token) return error(401, "unauthorized", "Please sign in.");
    if (!validCsrf(request))
      return error(403, "csrf_rejected", "Security check failed.");
    try {
      const upstream = await callBackend(path, { method: "POST", token });
      if (!upstream.ok && upstream.status !== 401) return upstreamResponse(upstream);
      const response = new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
      response.cookies.delete(sessionCookie);
      response.cookies.delete(csrfCookie);
      return response;
    } catch {
      return error(
        503,
        "backend_unavailable",
        "Authentication is temporarily unavailable.",
      );
    }
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return error(415, "unsupported_media_type", "JSON is required.");
  }
  let body = await request.text();
  if (body.length > 8_192)
    return error(413, "payload_too_large", "Request is too large.");
  try {
    JSON.parse(body);
  } catch {
    return error(400, "invalid_request", "Invalid JSON.");
  }
  try {
    const input: Record<string, unknown> = JSON.parse(body);
    if (!input || typeof input !== "object" || Array.isArray(input))
      return error(400, "invalid_request", "Invalid request.");
    if (action.startsWith("password-reset/")) {
      const flow = readEmailFlowCookie(request.cookies.get(resetCodeCookie)?.value);
      if (!flow) return error(400, "invalid_otp", "Verification expired. Start again.");
      // Never accept a browser-supplied challenge or reset grant.
      if (action.endsWith("resend-otp")) input.email = flow.email;
      else input.challengeId = flow.challengeId;
    }
    if (action === "reset-password") {
      const grant = request.cookies.get(resetGrantCookie)?.value;
      if (!grant) return error(400, "invalid_otp", "Verify your email code first.");
      input.resetToken = grant;
    }
    body = JSON.stringify(input);
    const upstream = await callBackend(path, { method: "POST", body });
    if (!upstream.ok) return upstreamResponse(upstream);
    if (action === "reset-password") {
      const response = await upstreamResponse(upstream);
      for (const name of [resetGrantCookie, resetCodeCookie, sessionCookie, csrfCookie])
        response.cookies.delete(name);
      return response;
    }
    if (action === "forgot-password" || action === "password-reset/resend-otp") {
      const data = (await upstream.json())?.data;
      const maxAge = Math.floor((Date.parse(data?.expiresAt) - Date.now()) / 1000);
      if (
        !data ||
        data.flow !== "reset" ||
        typeof data.challengeId !== "string" ||
        typeof data.email !== "string" ||
        !Number.isFinite(maxAge) ||
        maxAge <= 0
      )
        return error(502, "backend_error", "Invalid verification response.");
      const response = NextResponse.json(
        { data: { flow: data.flow, email: data.email, expiresAt: data.expiresAt } },
        { headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.set(
        resetCodeCookie,
        JSON.stringify({ challengeId: data.challengeId, email: data.email }),
        { ...cookieOptions(), maxAge },
      );
      response.cookies.delete(resetGrantCookie);
      return response;
    }
    if (action === "password-reset/verify-otp") {
      const data = (await upstream.json())?.data;
      const maxAge = Math.floor((Date.parse(data?.expiresAt) - Date.now()) / 1000);
      if (
        typeof data?.resetToken !== "string" ||
        !Number.isFinite(maxAge) ||
        maxAge <= 0
      )
        return error(502, "backend_error", "Invalid password reset response.");
      const response = NextResponse.json(
        { data: { verified: true } },
        { headers: { "Cache-Control": "no-store" } },
      );
      response.cookies.set(resetGrantCookie, data.resetToken, {
        ...cookieOptions(),
        maxAge,
      });
      response.cookies.delete(resetCodeCookie);
      return response;
    }
    if (action !== "login" && action !== "admin/login")
      return upstreamResponse(upstream);
    const payload = await upstream.json();
    const data = payload?.data;
    if (!data || typeof data.token !== "string" || !data.user || !data.expiresAt) {
      return error(
        502,
        "backend_error",
        "The authentication service returned an invalid response.",
      );
    }
    const maxAge = Math.floor((Date.parse(data.expiresAt) - Date.now()) / 1000);
    if (!Number.isFinite(maxAge) || maxAge <= 0)
      return error(502, "backend_error", "The authentication session has expired.");
    const response = NextResponse.json(
      { data: { user: data.user } },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(sessionCookie, data.token, { ...cookieOptions(), maxAge });
    response.cookies.set(csrfCookie, randomBytes(32).toString("base64url"), {
      ...cookieOptions(),
      httpOnly: false,
      maxAge,
    });
    return response;
  } catch {
    return error(
      503,
      "backend_unavailable",
      "Authentication is temporarily unavailable.",
    );
  }
}
