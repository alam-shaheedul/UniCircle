// Read-only production checks. No user credentials, writes, SMTP or LLM calls.
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const ORIGIN = "https://unicircle-cuet.vercel.app";
const REPOSITORY = "anindya357/UniCircle";

export function validateSha(value) {
  if (!/^[a-f0-9]{40}$/.test(value ?? ""))
    throw new Error("Expected a full Git commit SHA");
  return value;
}

export async function currentMain(
  fetcher = fetch,
  token = process.env.GITHUB_TOKEN,
) {
  const response = await fetcher(
    `https://api.github.com/repos/${REPOSITORY}/git/ref/heads/main`,
    {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!response.ok) throw new Error("Unable to verify the current main commit");
  return validateSha((await response.json()).object?.sha);
}

async function get(path, fetcher) {
  return fetcher(new URL(path, ORIGIN), {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    // Never send the GitHub token to Vercel or follow redirects with it.
    headers: {
      "User-Agent": "UniCircle-release-smoke",
      "Cache-Control": "no-cache",
    },
  });
}

export async function runChecks(sha, fetcher = fetch) {
  validateSha(sha);
  const health = await get("/api/health", fetcher);
  if (health.status !== 200)
    throw new Error("Private backend binding is unhealthy");
  const data = await health.json();
  if (data.status !== "ok" || data.revision !== sha)
    throw new Error("Production is not serving the expected commit");
  for (const path of ["/", "/login", "/register", "/admin/login"]) {
    const response = await get(path, fetcher);
    if (
      response.status !== 200 ||
      !(response.headers.get("content-type") ?? "").includes("text/html")
    ) {
      throw new Error(`Public page ${path} failed`);
    }
    const html = await response.text();
    if (!html.includes("UniCircle"))
      throw new Error(`Unexpected page at ${path}`);
  }
  for (const path of [
    "/directory",
    "/clubs",
    "/resources",
    "/transport",
    "/forum",
    "/news",
    "/assistant",
    "/admin",
  ]) {
    const response = await get(path, fetcher);
    const location = response.headers.get("location");
    const target = location ? new URL(location, ORIGIN) : null;
    if (
      ![302, 303, 307, 308].includes(response.status) ||
      target?.origin !== ORIGIN ||
      target.pathname !== "/login"
    ) {
      throw new Error(`Unauthenticated route ${path} was not protected`);
    }
  }
  // Ensure a release did not change halfway through the checks.
  const last = await get("/api/health", fetcher);
  if (last.status !== 200 || (await last.json()).revision !== sha)
    throw new Error("Production changed during smoke checks");
}

export async function waitForRelease(
  sha,
  {
    fetcher = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    attempts = 36,
  } = {},
) {
  validateSha(sha);
  for (let attempt = 0; attempt < attempts; attempt++) {
    if ((await currentMain(fetcher)) !== sha) return "superseded";
    let healthy = false;
    try {
      const response = await get("/api/health", fetcher);
      if (response.status === 200) {
        const data = await response.json();
        healthy = data.status === "ok" && data.revision === sha;
      }
    } catch {
      // A new function may still be starting. Only retry liveness, not failures
      // of smoke assertions once this commit is ready.
    }
    if (healthy) {
      await runChecks(sha, fetcher);
      if ((await currentMain(fetcher)) !== sha) return "superseded";
      return "verified";
    }
    if (attempt + 1 < attempts) await sleep(10_000);
  }
  throw new Error(
    "Timed out waiting for the CI-approved commit on the production domain",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const sha = validateSha(process.argv[2]);
    const result = await waitForRelease(sha);
    const summary =
      result === "verified"
        ? `Production smoke tests passed for ${sha}. Frontend, backend binding and authentication redirects verified.`
        : `Skipped ${sha}: a newer main commit superseded this release.`;
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  } catch (error) {
    // Do not log raw response bodies, headers, tokens or HTTP-library errors.
    console.error(
      error instanceof Error ? error.message : "Release smoke checks failed",
    );
    process.exitCode = 1;
  }
}
