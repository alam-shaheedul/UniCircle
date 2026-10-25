// Check the built container, using existing Playwright tooling rather than a dev server.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

import { chromium, devices, expect } from "@playwright/test";

const baseURL = process.argv[2] ?? "http://127.0.0.1:3215";
const container = process.argv[3] ?? "unicircle-frontend-phase102-check";
assert(/^[a-zA-Z0-9_.-]+$/.test(container), "Use an explicit container name.");
const target = new URL(baseURL);
assert(
  ["localhost", "127.0.0.1"].includes(target.hostname),
  "Use a loopback test URL.",
);
const inspect = JSON.parse(
  execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
)[0];
assert.equal(inspect.State.Health.Status, "healthy", "Docker health check must pass.");
const image = JSON.parse(
  execFileSync("docker", ["image", "inspect", inspect.Image], { encoding: "utf8" }),
)[0];
assert(
  !image.Config.Env.some((entry) =>
    /^(BACKEND_API_URL|JWT_SECRET|DATABASE_URL|SMTP_PASSWORD)=/.test(entry),
  ),
  "Runtime settings must not be baked into the image.",
);
const artifactChecks = `
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(process.getuid(), 1000);
assert.equal(fs.statSync('/app/server.js').uid, 0);
assert(fs.existsSync('/app/.next/static'));
assert(fs.existsSync('/app/public/media/home'));
for (const name of ['typescript', 'eslint', '@playwright/test']) {
  assert(!fs.existsSync('/app/node_modules/' + name), 'Dev tool included: ' + name);
}
function scan(path) {
  for (const entry of fs.readdirSync(path, {withFileTypes: true})) {
    assert(!entry.name.startsWith('.env'), 'Environment file included');
    assert(!['AGENTS.md', 'CLAUDE.md'].includes(entry.name), 'Agent file included');
    if (entry.isDirectory()) scan(path + '/' + entry.name);
  }
}
scan('/app');
console.log('Non-root runtime, static assets, dev-tool exclusion, and secret-file exclusion passed.');
`;
console.log(
  execFileSync("docker", ["exec", "-i", container, "node"], {
    input: artifactChecks,
    encoding: "utf8",
  }).trim(),
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
await mkdir("../tmp/docker-frontend", { recursive: true });
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", devices["Pixel 7"].viewport],
  ]) {
    const context = await browser.newContext({ baseURL, viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(baseURL) && response.status() >= 500) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });
    const home = await page.goto("/", { waitUntil: "networkidle" });
    assert.equal(home.status(), 200);
    await expect(page.getByText("Welcome to CUET Campus")).toBeVisible();
    await expect(page.getByRole("link", { name: "Login", exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign up", exact: true }),
    ).toBeVisible();
    const media = await page.locator("video source").getAttribute("src");
    const video = await context.request.get(media, {
      headers: { Range: "bytes=0-1023" },
    });
    assert(
      [200, 206].includes(video.status()),
      "Campus video must be served from public/.",
    );
    const image = page.locator("main img").first();
    await expect(image).toBeVisible();
    assert(await image.evaluate((img) => img.complete && img.naturalWidth > 0));
    const imageSource = await image.getAttribute("src");
    assert(
      (await context.request.get(imageSource)).ok(),
      "Campus image must be served.",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: `../tmp/docker-frontend/${name}-home.png`,
      fullPage: true,
    });

    await page.goto("/directory");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Sign in to UniCircle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Username or CUET email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.screenshot({
      path: `../tmp/docker-frontend/${name}-login.png`,
      fullPage: true,
    });

    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("First name is required.")).toBeVisible();
    await expect(page.getByText("Student ID is required.")).toBeVisible();
    await page.getByLabel("Teacher").check();
    await expect(page.getByLabel(/Teacher ID/)).toBeVisible();
    await page.getByLabel("Staff").check();
    await expect(page.getByLabel(/Staff ID/)).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: `../tmp/docker-frontend/${name}-register.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, [], `Browser errors at ${name} viewport`);
    console.log(
      `${name}: Home, campus media, protected routes, login, and registration passed.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
