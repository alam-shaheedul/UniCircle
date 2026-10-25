import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("release health", () => {
  it("checks the private binding and returns only the public Git revision", async () => {
    vi.stubEnv("BACKEND_API_URL", "https://private.example.test");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { status: "ok", service: "unicircle-api" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", revision: "a".repeat(40) });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetcher.mock.calls[0][0].href).toBe("https://private.example.test/health");
    expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
  });

  it("does not expose arbitrary environment content as a revision", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "not-a-commit-or-public-value");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: { status: "ok" } })),
    );
    expect(await (await GET()).json()).toEqual({ status: "ok", revision: null });
  });

  it.each([503, 200])(
    "fails closed on an invalid backend response (%s)",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(Response.json({ data: { status: "failed" } }, { status })),
      );
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable" });
    },
  );

  it("does not expose connection details on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private credentials")));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private credentials");
  });
});
