// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ origin: vi.fn(() => true) }));
vi.mock("@/lib/server/same-origin", () => ({ isSameOrigin: mocks.origin }));
vi.mock("@/features/auth/lib/email-flow-cookie", () => ({
  resetCodeCookie: "unicircle_reset_code",
  resetGrantCookie: "unicircle_reset_grant",
  readEmailFlowCookie: (value?: string) => {
    try {
      return JSON.parse(value ?? "null");
    } catch {
      return null;
    }
  },
}));

import { POST } from "@/app/api/auth/[...action]/route";

const email = "student@student.cuet.ac.bd";
const expiresAt = () => new Date(Date.now() + 600_000).toISOString();
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  mocks.origin.mockReturnValue(true);
  vi.stubGlobal("fetch", fetchMock);
});

function post(action: string, body: unknown, cookie = "") {
  return POST(
    new NextRequest(`http://localhost:3000/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action: action.split("/") }) },
  );
}

function upstream(data: unknown) {
  fetchMock.mockResolvedValueOnce(Response.json({ data }));
}

test("recovery stores an HttpOnly challenge without leaking its ID", async () => {
  upstream({
    flow: "reset",
    email,
    challengeId: "private-challenge-id",
    expiresAt: expiresAt(),
  });
  const response = await post("forgot-password", { email });
  expect(response.status).toBe(200);
  expect(response.cookies.get("unicircle_session")).toBeUndefined();
  expect(response.cookies.get("unicircle_reset_code")?.httpOnly).toBe(true);
  expect(await response.text()).not.toContain("private-challenge-id");
});

test("normal sign-in creates an HttpOnly session without exposing its token", async () => {
  upstream({
    token: "private-session-token",
    user: { role: "student" },
    expiresAt: expiresAt(),
  });
  const response = await post("login", {
    identifier: "student",
    password: "StrongPass123",
  });
  expect(response.cookies.get("unicircle_session")?.httpOnly).toBe(true);
  expect(await response.text()).not.toContain("private-session-token");
});

test("reset verification keeps the reset grant out of JavaScript and URLs", async () => {
  upstream({ resetToken: "private-reset-token", expiresAt: expiresAt() });
  const cookie = `unicircle_reset_code=${encodeURIComponent(JSON.stringify({ challengeId: "bound-id", email }))}`;
  const response = await post(
    "password-reset/verify-otp",
    { otp: "123456", challengeId: "injected" },
    cookie,
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).challengeId).toBe(
    "bound-id",
  );
  expect(response.cookies.get("unicircle_reset_grant")?.httpOnly).toBe(true);
  expect(await response.json()).toEqual({ data: { verified: true } });
});

test("direct password reset without verified grant and cross-origin requests fail closed", async () => {
  expect(
    (
      await post("reset-password", {
        password: "StrongPass123",
        resetToken: "injected",
      })
    ).status,
  ).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
  mocks.origin.mockReturnValue(false);
  expect((await post("forgot-password", { email })).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("saving the password uses its cookie grant and clears stale authentication cookies", async () => {
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const response = await post(
    "reset-password",
    { password: "ChangedPass123", resetToken: "injected" },
    "unicircle_reset_grant=bound-grant",
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).resetToken).toBe(
    "bound-grant",
  );
  expect(response.status).toBe(204);
  expect(response.cookies.get("unicircle_reset_grant")?.value).toBe("");
  expect(response.cookies.get("unicircle_session")?.value).toBe("");
});

test("recovery resend uses its email cookie and replaces failed-delivery challenges", async () => {
  upstream({
    flow: "reset",
    email,
    challengeId: "new-recovery-challenge",
    expiresAt: expiresAt(),
  });
  const cookie = `unicircle_reset_code=${encodeURIComponent(JSON.stringify({ challengeId: "failed-delivery-id", email }))}`;
  const response = await post(
    "password-reset/resend-otp",
    { email: "injected@cuet.ac.bd" },
    cookie,
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string).email).toBe(email);
  expect(response.cookies.get("unicircle_reset_code")?.value).toContain(
    "new-recovery-challenge",
  );
  expect(await response.text()).not.toContain("new-recovery-challenge");
});
