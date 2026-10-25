// Real production images and PostgreSQL; synthetic accounts in an isolated project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

// Reuse installed test tooling to verify an otherwise dependency-free clone.
const root = process.argv[3]
  ? resolve(process.argv[3])
  : fileURLToPath(new URL("../../", import.meta.url));
const version = process.argv[2];
assert(version && /^[a-zA-Z0-9_.-]+$/.test(version), "Supply the built image tag.");
const project = `unicircle-compose-smoke-${randomBytes(6).toString("hex")}`;
const mailDir = `${root}/tmp/docker-compose/${project}-mail`;
mkdirSync(mailDir, { recursive: true });
const env = {
  ...process.env,
  IMAGE_TAG: version,
  POSTGRES_DB: "unicircle_compose_smoke",
  POSTGRES_USER: "unicircle_smoke",
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  POSTGRES_PORT: "0",
  FRONTEND_PORT: "0",
  JWT_SECRET: randomBytes(48).toString("hex"),
  OTP_PEPPER: randomBytes(48).toString("hex"),
  COMPOSE_SMOKE_MAIL_DIR: mailDir,
  SMTP_HOST: "smtp",
  SMTP_PORT: "15465",
  SMTP_TLS_MODE: "ssl",
  SMTP_USERNAME: "compose-smoke",
  SMTP_PASSWORD: "synthetic-smoke-password",
  SMTP_FROM_EMAIL: "smoke@cuet.ac.bd",
  OLLAMA_BASE_URL: "http://model.invalid:11434",
};
// No inherited custom URL or real SMTP/model endpoint may reach the test DB.
delete env.DOCKER_DATABASE_URL;
const composeArgs = [
  "compose",
  "--env-file",
  ".env.compose.example",
  "--project-name",
  project,
  "--file",
  "compose.yaml",
  "--file",
  "compose.test.yaml",
];
const docker = (args, input) =>
  execFileSync("docker", args, {
    cwd: root,
    env,
    input,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
const compose = (args, input) => docker([...composeArgs, ...args], input);
const run = (args) => {
  execFileSync("docker", [...composeArgs, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
  });
};
let browser;
let created = false;
try {
  assert.equal(
    docker([
      "volume",
      "ls",
      "--filter",
      `name=${project}_postgres_data`,
      "--quiet",
    ]).trim(),
    "",
  );
  created = true;
  run(["up", "--no-build", "--detach", "--wait", "--wait-timeout", "180"]);
  const port = compose(["port", "frontend", "3000"]).trim();
  const baseURL = `http://${port}`;
  const ids = {};
  for (const service of ["frontend", "backend", "migrate", "postgres"]) {
    ids[service] = compose(["ps", "--all", "--quiet", service]).trim();
    const container = JSON.parse(docker(["inspect", ids[service]]))[0];
    if (service === "migrate") assert.equal(container.State.ExitCode, 0);
    else assert.equal(container.State.Health.Status, "healthy");
    {
      assert(container.HostConfig.ReadonlyRootfs);
      assert(container.HostConfig.CapDrop.includes("ALL"));
      assert(container.HostConfig.SecurityOpt.includes("no-new-privileges:true"));
      if (service !== "postgres") assert(container.HostConfig.Init);
      assert(container.Config.User && container.Config.User !== "root");
    }
    if (service === "backend")
      assert.equal(Object.keys(container.HostConfig.PortBindings ?? {}).length, 0);
    const image = JSON.parse(docker(["image", "inspect", container.Image]))[0];
    assert(
      !image.Config.Env.some((item) =>
        /^(JWT_SECRET|OTP_PEPPER|SMTP_PASSWORD|DATABASE_URL)=/.test(item),
      ),
    );
  }
  const pgNetworks = JSON.parse(docker(["inspect", ids.postgres]))[0].NetworkSettings
    .Networks;
  const frontNetworks = JSON.parse(docker(["inspect", ids.frontend]))[0].NetworkSettings
    .Networks;
  assert(
    !Object.keys(pgNetworks).some((network) => Object.hasOwn(frontNetworks, network)),
  );
  const migration = compose([
    "exec",
    "-T",
    "backend",
    "python",
    "-m",
    "alembic",
    "current",
  ]);
  assert(migration.includes("(head)"));
  console.log(
    "Migrations, health, private routing, read-only/non-root permissions, and secret exclusions passed.",
  );
  // Reuse the public-page/media and runtime-file exclusion checks as well.
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("./verify_docker.mjs", import.meta.url)),
      baseURL,
      ids.frontend,
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env,
      stdio: "inherit",
    },
  );
  console.log(
    compose(
      ["exec", "-T", "backend", "python", "-"],
      readFileSync(`${root}/scripts/docker_smoke_fixture.py`, "utf8"),
    ).trim(),
  );

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  const contexts = [];
  async function login(
    identifier,
    admin = false,
    viewport = { width: 1440, height: 1000 },
  ) {
    const context = await browser.newContext({ baseURL, viewport });
    contexts.push(context);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
    await page.goto(admin ? "/admin/login" : "/login", {
      waitUntil: "networkidle",
    });
    await page
      .getByLabel(admin ? /Admin ID/ : "Username or CUET email")
      .fill(identifier);
    await page
      .getByLabel("Password")
      .fill(admin ? "ComposeAdminPass123!" : "ComposeTestPass123!");
    const [loginResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/auth/"),
        { timeout: 30_000 },
      ),
      page
        .getByRole("button", {
          name: admin ? "Access Admin portal" : "Sign in",
          exact: true,
        })
        .click(),
    ]);
    assert.equal(loginResponse.status(), 200, `Login failed for ${identifier}`);
    await expect(page).toHaveURL(admin ? /\/admin$/ : new RegExp(`${baseURL}/$`), {
      timeout: 30_000,
    });
    const cookies = await context.cookies();
    const session = cookies.find((item) => item.name === "unicircle_session");
    assert(session?.httpOnly && session.secure && session.sameSite === "Lax");
    assert(!(await page.evaluate(() => document.cookie)).includes("unicircle_session"));
    const user = await api({ context, page }, "/api/auth/me");
    return { context, page, user };
  }
  async function api(actor, path, method = "GET", data, expected = 200) {
    const csrf = (await actor.context.cookies()).find(
      (cookie) => cookie.name === "unicircle_csrf",
    )?.value;
    // Use real browser fetch: Playwright's API cookie jar does not treat HTTP
    // loopback like Chromium does for Secure cookies. Never weaken app cookies.
    const response = await actor.page.evaluate(
      async ({ path, method, data, csrf }) => {
        const upstream = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf ?? "" },
          body: data === undefined ? undefined : JSON.stringify(data),
        });
        return {
          status: upstream.status,
          body: upstream.status === 204 ? null : await upstream.json(),
        };
      },
      { path, method, data, csrf },
    );
    const body = response.body;
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: ${JSON.stringify(body)}`,
    );
    return body?.data;
  }
  const student = await login("docker.student1");
  const member = await login("docker.student2");
  const outsider = await login("docker.student3");
  const admin = await login("docker-admin", true);
  const registrationContext = await browser.newContext({ baseURL });
  contexts.push(registrationContext);
  const registrationPage = await registrationContext.newPage();
  registrationPage.on("pageerror", (error) =>
    errors.push(`${registrationPage.url()}: ${error.message}`),
  );
  await registrationPage.goto("/register");
  await registrationPage.getByLabel(/First Name/).fill("Docker");
  await registrationPage.getByLabel(/Last Name/).fill("Registration");
  await registrationPage.getByLabel(/Home Address/).fill("Synthetic CUET test address");
  await registrationPage.getByLabel("Username").fill("docker.registration");
  await registrationPage
    .getByLabel("Email")
    .fill("docker.registration@student.cuet.ac.bd");
  await registrationPage.locator("#password").fill("ComposeTestPass123!");
  await registrationPage.locator("#confirm-password").fill("ComposeTestPass123!");
  await registrationPage.locator("#university-id").fill("docker-registration");
  await registrationPage
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(registrationPage).toHaveURL(/\/verify-otp/);
  await api(
    { context: registrationContext, page: registrationPage },
    "/api/auth/login",
    "POST",
    {
      identifier: "docker.registration",
      password: "ComposeTestPass123!",
    },
    401,
  );
  const mailName = createHash("sha256")
    .update("docker.registration@student.cuet.ac.bd")
    .digest("hex");
  const code = JSON.parse(readFileSync(`${mailDir}/${mailName}.json`, "utf8")).code;
  assert(/^\d{6}$/.test(code));
  await registrationPage.getByLabel(/Verification code/).fill(code);
  await registrationPage
    .getByRole("button", { name: "Verify account", exact: true })
    .click();
  await expect(registrationPage).toHaveURL(/\/login\?verified=1/);
  await login("docker.registration");
  console.log(
    "Real registration, TLS/authenticated test-mail delivery, OTP verification, and verified login passed.",
  );
  assert.equal((await api(student, "/api/directory")).length, 12);
  assert((await api(student, "/api/campus-explorer")).locations.length > 0);
  assert.equal((await api(student, "/api/club-events/clubs")).length, 10);
  assert((await api(student, "/api/transport/transport/snapshot")).drivers.length > 0);
  await api(student, "/api/news/admin/news", "GET", undefined, 403);
  const start = new Date(Date.now() + 48 * 3600_000);
  const eventBody = {
    title: "Compose integration workshop",
    category: "Workshop",
    summary: "Synthetic container journey",
    location: "CUET",
    starts_at: start.toISOString(),
    ends_at: new Date(+start + 3600_000).toISOString(),
    registration_enabled: true,
  };
  const event = await api(
    student,
    "/api/club-events/clubs/cuet-computer-club/events",
    "POST",
    eventBody,
    201,
  );
  await api(outsider, `/api/club-events/events/${event.id}`, "PUT", eventBody, 403);
  await api(student, `/api/club-events/events/${event.id}`, "PUT", {
    ...eventBody,
    title: "Updated compose workshop",
  });
  await api(member, `/api/club-events/events/${event.id}/interest`, "PUT", {
    status: "going",
  });
  await api(
    member,
    `/api/club-events/events/${event.id}/registrations`,
    "POST",
    {
      participant_name: "Docker Student 2",
      email: "docker2@student.cuet.ac.bd",
      student_id: "docker-student-2",
      department_name: "CSE",
    },
    201,
  );
  await api(
    student,
    "/api/club-events/clubs/cuet-computer-club/membership-settings",
    "PUT",
    {
      recruitment_open: true,
      bkash_number: "01700000001",
      nagad_number: "01800000001",
    },
  );
  const membership = await api(
    member,
    "/api/club-events/clubs/cuet-computer-club/membership-requests",
    "POST",
    {
      applicant_name: "Docker Student 2",
      email: "docker2@student.cuet.ac.bd",
      student_id: "docker-student-2",
      department_name: "CSE",
      phone: "01900000001",
      motivation: "I would like to participate in this synthetic club test.",
      payment_method: "bkash",
      transaction_id: "SYNTHETIC-COMPOSE-TRX",
    },
    201,
  );
  await api(
    student,
    `/api/club-events/clubs/cuet-computer-club/membership-requests/${membership.id}/approve`,
    "POST",
    {},
  );
  await api(student, "/api/club-events/clubs/cuet-computer-club/admins", "POST", {
    student_id: "docker-student-2",
  });
  console.log(
    "Club/event CRUD, scoped admin authorization, registration, interest, and membership approval passed.",
  );
  const resourceProfile = { is_discoverable: true, categories: ["notebook"] };
  await api(
    member,
    "/api/resource-sharing/resource-profile/me",
    "PATCH",
    resourceProfile,
  );
  const request = await api(
    student,
    "/api/resource-sharing/resource-requests",
    "POST",
    {
      recipient_id: member.user.id,
      category: "notebook",
      resource_name: "Compose notebook",
      description: "Synthetic resource exchange",
    },
    201,
  );
  const accepted = await api(
    member,
    `/api/resource-sharing/resource-requests/${request.id}/decision`,
    "POST",
    { decision: "accepted" },
  );
  assert(accepted.conversationId);
  await api(
    student,
    `/api/resource-sharing/conversations/${accepted.conversationId}/messages`,
    "POST",
    { body: "Meet at CUET." },
    201,
  );
  await api(
    member,
    `/api/resource-sharing/conversations/${accepted.conversationId}/messages`,
  );
  await api(
    outsider,
    `/api/resource-sharing/conversations/${accepted.conversationId}/messages`,
    "GET",
    undefined,
    404,
  );
  const post = await api(
    student,
    "/api/forum/forum/posts",
    "POST",
    { body: "Compose forum discussion" },
    201,
  );
  await api(
    member,
    `/api/forum/forum/posts/${post.id}/comments`,
    "POST",
    { body: "Container reply" },
    201,
  );
  const report = await api(
    member,
    `/api/forum/forum/posts/${post.id}/reports`,
    "POST",
    { reason: "Synthetic moderation check" },
    201,
  );
  await api(admin, `/api/forum/admin/forum/reports/${report.id}`, "PUT", {
    decision: "post-removed",
  });
  await api(student, `/api/forum/forum/posts/${post.id}`, "GET", undefined, 404);
  const news = await api(
    admin,
    "/api/news/admin/news",
    "POST",
    {
      type: "announcement",
      title: "Compose campus update",
      summary: "Docker test announcement",
      content: ["Synthetic public announcement."],
      audience: "All CUET members",
      status: "published",
    },
    201,
  );
  assert((await api(member, "/api/news/news")).some((item) => item.id === news.id));
  const notifications = await api(member, "/api/club-events/notifications/me");
  assert(notifications.some((item) => item.title === "Compose campus update"));
  await api(
    member,
    `/api/club-events/notifications/${notifications[0].id}/read`,
    "PUT",
    {},
  );
  const driver = await api(
    admin,
    "/api/transport/admin/transport/drivers",
    "POST",
    {
      name: "Synthetic Compose Driver",
      phone: "01700000002",
      driver_class: "heavy",
    },
    201,
  );
  await api(admin, `/api/transport/admin/transport/drivers/${driver.id}`, "PUT", {
    name: "Updated Compose Driver",
    phone: "01700000002",
    driver_class: "heavy",
  });
  await api(
    admin,
    `/api/transport/admin/transport/drivers/${driver.id}`,
    "DELETE",
    undefined,
    204,
  );
  const answer = await api(student, "/api/assistant/ask", "POST", {
    question: "Where is CUET?",
  });
  assert.equal(answer.status, "not-found");
  console.log(
    "Resource acceptance/chat privacy, forum moderation, news/notifications, transport admin, and empty-index RAG fallback passed.",
  );
  mkdirSync(`${root}/tmp/docker-compose`, { recursive: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 412, height: 915 },
  ]) {
    await student.page.setViewportSize(viewport);
    for (const path of [
      "/",
      "/directory",
      "/campus-explorer",
      "/clubs",
      "/clubs/cuet-computer-club",
      "/events",
      "/resources",
      "/chat",
      "/transport",
      "/forum",
      "/news",
      "/assistant",
      "/profile",
      "/notifications",
    ]) {
      // Live notifications/polling and map tiles need not go network-idle.
      // Wait for document/assets and the rendered UI instead.
      const response = await student.page.goto(path, {
        waitUntil: "load",
        timeout: 60_000,
      });
      assert.equal(response.status(), 200, path);
      // Next.js streaming can temporarily retain a hidden fallback main.
      // Require exactly one visible main, not an arbitrary first match.
      await expect(
        student.page.locator("main:visible"),
        `Main content at ${path} (${viewport.width}px)`,
      ).toHaveCount(1, { timeout: 30_000 });
      await expect(
        student.page.getByText("Page not found", { exact: true }),
      ).toHaveCount(0);
      await student.page.evaluate(() => document.fonts.ready);
      await expect
        .poll(
          () =>
            student.page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth + 1,
            ),
          {
            timeout: 10_000,
            message: `Overflow at ${path} (${viewport.width}px)`,
          },
        )
        .toBe(true);
    }
    await student.page.screenshot({
      path: `${root}/tmp/docker-compose/${viewport.width}-authenticated.png`,
      fullPage: true,
    });
  }
  // Preserve the business invariant: an event with registrations cannot be deleted.
  await api(student, `/api/club-events/events/${event.id}`, "DELETE", undefined, 409);
  const disposableEvent = await api(
    student,
    "/api/club-events/clubs/cuet-computer-club/events",
    "POST",
    {
      ...eventBody,
      title: "Unregistered deletion probe",
      registration_enabled: false,
    },
    201,
  );
  await api(
    student,
    `/api/club-events/events/${disposableEvent.id}`,
    "DELETE",
    undefined,
    204,
  );
  await api(admin, `/api/news/admin/news/${news.id}`, "DELETE", undefined, 204);
  await api(student, "/api/auth/logout", "POST", {}, 204);
  await student.page.goto("/directory");
  await expect(student.page).toHaveURL(/\/login$/);
  assert.deepEqual(errors, []);
  for (const context of contexts) await context.close();
  await browser.close();
  browser = undefined;
  // Recreate the app processes without touching PostgreSQL's named volume.
  run([
    "up",
    "--no-build",
    "--detach",
    "--force-recreate",
    "--no-deps",
    "--wait",
    "--wait-timeout",
    "120",
    "backend",
    "frontend",
  ]);
  const count = compose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    env.POSTGRES_USER,
    "-d",
    env.POSTGRES_DB,
    "-Atc",
    "SELECT count(*) FROM users;",
  ]).trim();
  assert.equal(count, "5");
  run(["stop", "--timeout", "30", "backend", "frontend"]);
  for (const [service, expectedCodes] of [
    ["backend", [0, 143]],
    ["frontend", [0, 143]],
  ]) {
    const id = compose(["ps", "--all", "--quiet", service]).trim();
    const state = JSON.parse(docker(["inspect", "--format", "{{json .State}}", id]));
    assert(
      expectedCodes.includes(state.ExitCode) && !state.OOMKilled && !state.Running,
      `${service} did not stop cleanly: exit=${state.ExitCode}`,
    );
    if (service === "backend") {
      assert(
        compose(["logs", "--no-color", "backend"]).includes(
          "Application shutdown complete.",
        ),
        "API must complete application shutdown before exiting",
      );
    }
  }
  console.log(
    "Desktop/mobile pages, Secure/HttpOnly sessions, logout, persistence, and graceful shutdown passed.",
  );
} finally {
  if (browser) await browser.close();
  if (created) {
    assert(/^unicircle-compose-smoke-[0-9a-f]{12}$/.test(project));
    run(["down", "--volumes", "--remove-orphans"]);
  }
}
