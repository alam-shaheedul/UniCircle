import "server-only";

import type { NextRequest } from "next/server";

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    // The browser controls Origin and Host; Next.js may canonicalize nextUrl.host.
    return (
      origin === parsed.origin &&
      parsed.host === host &&
      parsed.protocol === request.nextUrl.protocol
    );
  } catch {
    return false;
  }
}
