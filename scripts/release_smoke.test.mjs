import assert from "node:assert/strict";
import test from "node:test";
import {
  currentMain,
  ORIGIN,
  runChecks,
  validateSha,
  waitForRelease,
} from "./release_smoke.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

function fixture({ revision = SHA, latest = SHA, override = () => null } = {}) {
  const calls = [];
  const fetcher = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    const changed = override(url);
    if (changed) return changed;
    if (url.hostname === "api.github.com")
      return Response.json({ object: { sha: latest } });
    assert.equal(url.origin, ORIGIN);
    if (url.pathname === "/api/health")
      return Response.json({ status: "ok", revision });
    if (["/", "/login", "/register", "/admin/login"].includes(url.pathname)) {
      return new Response("<html>UniCircle</html>", {
        headers: { "content-type": "text/html" },
      });
    }
    return new Response(null, { status: 307, headers: { location: "/login" } });
  };
  return { fetcher, calls };
}

test("rejects invalid and injected commit values", () => {
  for (const value of [
    undefined,
    "main",
    "a".repeat(39),
    `${SHA}\n`,
    `${SHA};pwd`,
  ]) {
    assert.throws(() => validateSha(value));
  }
  assert.equal(validateSha(SHA), SHA);
});

test("checks public pages, backend health and protected routes without user credentials", async () => {
  const { fetcher, calls } = fixture();
  await runChecks(SHA, fetcher);
  assert.equal(calls.length, 14);
  for (const { options } of calls) {
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.method, undefined); // GET only: never changes production records.
  }
});

test("cannot verify an old release", async () => {
  await assert.rejects(
    runChecks(SHA, fixture({ revision: OTHER }).fetcher),
    /expected commit/,
  );
});

test("fails on unhealthy private service binding", async () => {
  const { fetcher } = fixture({
    override: (url) =>
      url.pathname === "/api/health"
        ? new Response(null, { status: 503 })
        : null,
  });
  await assert.rejects(runChecks(SHA, fetcher), /unhealthy/);
});

test("rejects Vercel protection and missing frontend pages", async () => {
  for (const status of [401, 404, 500]) {
    const { fetcher } = fixture({
      override: (url) =>
        url.pathname === "/login" ? new Response(null, { status }) : null,
    });
    await assert.rejects(runChecks(SHA, fetcher), /Public page/);
  }
});

test("rejects unprotected routes and external login redirects", async () => {
  for (const response of [
    new Response("<html>UniCircle</html>"),
    new Response(null, {
      status: 307,
      headers: { location: "https://other.test/login" },
    }),
  ]) {
    const { fetcher } = fixture({
      override: (url) => (url.pathname === "/admin" ? response : null),
    });
    await assert.rejects(runChecks(SHA, fetcher), /not protected/);
  }
});

test("fails if production changes during checks", async () => {
  let count = 0;
  const { fetcher } = fixture({
    override: (url) => {
      if (url.pathname === "/api/health" && ++count === 2)
        return Response.json({ revision: OTHER });
      return null;
    },
  });
  await assert.rejects(runChecks(SHA, fetcher), /changed during/);
});

test("GitHub token is only sent to the fixed GitHub API, with redirects disabled", async () => {
  const { fetcher, calls } = fixture();
  assert.equal(await currentMain(fetcher, "test-only-token"), SHA);
  assert.equal(calls[0].url.hostname, "api.github.com");
  assert.equal(
    calls[0].options.headers.Authorization,
    "Bearer test-only-token",
  );
  assert.equal(calls[0].options.redirect, "error");
});

test("does not mask a GitHub API failure as a successful release", async () => {
  await assert.rejects(
    currentMain(async () => new Response(null, { status: 403 })),
    /Unable to verify/,
  );
});

test("skips superseded commits without probing production", async () => {
  const { fetcher, calls } = fixture({ latest: OTHER });
  assert.equal(await waitForRelease(SHA, { fetcher }), "superseded");
  assert.equal(calls.length, 1);
});

test("waits for the correct release and then verifies it", async () => {
  let polls = 0;
  let sleeps = 0;
  const { fetcher } = fixture({
    override: (url) => {
      if (url.pathname === "/api/health" && ++polls === 1)
        return Response.json({ status: "ok", revision: OTHER });
      return null;
    },
  });
  assert.equal(
    await waitForRelease(SHA, {
      fetcher,
      sleep: async () => {
        sleeps++;
      },
      attempts: 2,
    }),
    "verified",
  );
  assert.equal(sleeps, 1);
});

test("never reports success when the expected release never appears", async () => {
  const { fetcher } = fixture({ revision: OTHER });
  await assert.rejects(
    waitForRelease(SHA, { fetcher, sleep: async () => {}, attempts: 2 }),
    /Timed out/,
  );
});
