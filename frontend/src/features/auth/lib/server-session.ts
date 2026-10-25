import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { SessionUser } from "@/features/auth/types/session-user";
import { normalizeSessionUser } from "@/services/api/api-auth-service";

export const getServerSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get("unicircle_session")?.value;
  if (!token) return null;
  const backendBase = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(new URL("/api/v1/auth/me", backendBase), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Authentication backend unavailable");
    const result: { data: SessionUser } = await response.json();
    return normalizeSessionUser(result.data);
  } catch {
    throw new Error("Authentication backend unavailable");
  }
});

export async function requireServerSessionUser(): Promise<SessionUser> {
  const user = await getServerSessionUser();
  if (!user) redirect("/login");
  return user;
}
