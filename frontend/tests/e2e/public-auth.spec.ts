import { expect, test } from "@playwright/test";

test("public home exposes account entry points and protected routes redirect", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "UniCircle home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up", exact: true })).toBeVisible();
  await expect(page.getByText("Welcome to CUET Campus")).toBeVisible();

  await page.goto("/directory");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to UniCircle" }),
  ).toBeVisible();
});

test("registration presents CUET and role-specific validation", async ({ page }) => {
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("First name is required.")).toBeVisible();
  await expect(page.getByText("Student ID is required.")).toBeVisible();

  await page.getByLabel("Email").fill("student@example.com");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /student\.cuet\.ac\.bd/ }),
  ).toBeVisible();

  await page.getByLabel("Teacher").check();
  await expect(page.getByLabel(/Teacher ID/)).toBeVisible();
  await page.getByLabel("Staff").check();
  await expect(page.getByLabel(/Staff ID/)).toBeVisible();
});

test("registration, fixed test OTP, login, directory, and AI journey", async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name.startsWith("mobile") ? "mobile" : "desktop";
  const email = `phase9.${suffix}@student.cuet.ac.bd`;
  await page.goto("/register");
  await page.getByLabel(/First Name/).fill("Phase");
  await page.getByLabel(/Last Name/).fill("Nine");
  await page.getByLabel(/Home Address/).fill("CUET Campus");
  await page.getByLabel("Username").fill(`phase9.${suffix}`);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill("TestingPass123!");
  await page.locator("#confirm-password").fill("TestingPass123!");
  await page.locator("#university-id").fill(`u-phase9-${suffix}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-otp/);
  await page.getByLabel(/Verification code/).fill("123456");
  await page.getByRole("button", { name: "Verify account" }).click();
  await expect(page).toHaveURL(/\/login\?verified=1/);
  await page.getByLabel("Username or CUET email").fill(`phase9.${suffix}`);
  await page.getByLabel("Password").fill("TestingPass123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/directory");
  await expect(
    page.getByRole("heading", { name: /Find the people shaping/ }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /EEE/ }).click();
  await expect(page.getByRole("heading", { name: /Electrical/i })).toBeVisible();

  await page.goto("/events");
  const going = page.getByRole("button", { name: "Going" }).first();
  await going.click();
  await expect(going).toHaveAttribute("aria-pressed", "true");

  await page.goto("/assistant");
  await page.getByLabel("Ask a campus question").fill("Where is CUET?");
  await page.getByRole("button", { name: /Ask assistant/ }).click();
  await expect(page.getByText(/Controlled CUET answer/)).toBeVisible();
});

test("login and OTP pages provide complete accessible forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Username or CUET email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: /Create an account/ })).toBeVisible();

  await page.goto("/verify-otp?email=test%40student.cuet.ac.bd");
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(page.getByLabel(/verification code/i)).toBeVisible();
});

test("admin login reaches protected transport, news, and moderation workspaces", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel(/Admin ID/).fill("e2e-admin");
  await page.getByLabel("Password").fill("AdminPass123!");
  await page.getByRole("button", { name: "Access Admin portal" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();

  await page
    .getByRole("button", { name: /^Transport/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Transport management" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Announcements/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "News & announcements" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Reports/ })
    .first()
    .click();
  await expect(page.getByText(/community reports/i).first()).toBeVisible();
});
