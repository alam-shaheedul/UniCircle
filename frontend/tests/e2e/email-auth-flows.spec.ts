import { expect as baseExpect, test, type Page } from "@playwright/test";

// First visits compile new Next.js development routes on the Windows test host.
const expect = baseExpect.configure({ timeout: 30_000 });

async function assertFits(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
  const code = page.getByLabel(/Verification code/);
  if (await code.count()) {
    const box = await code.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      await page.evaluate(() => innerHeight),
    );
  }
}

test("registration OTP and email-code password reset work on both screens", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  // Never run credential writes against production. SMTP is captured by e2e_server.
  expect(new URL(baseURL ?? "").hostname).toBe("127.0.0.1");
  const suffix = testInfo.project.name;
  const email = `reset.${suffix}@student.cuet.ac.bd`;
  await page.goto("/register");
  await page.getByLabel(/First Name/).fill("Email");
  await page.getByLabel(/Last Name/).fill("Flow");
  await page.getByLabel(/Home Address/).fill("CUET Campus");
  await page.getByLabel(/Username/).fill(`reset.${suffix}`);
  await page.getByLabel(/CUET email/).fill(email);
  await page.locator("#password").fill("OriginalPass123");
  await page.locator("#confirm-password").fill("OriginalPass123");
  await page.locator("#university-id").fill(`reset-${suffix}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-otp\?email=/, { timeout: 30_000 });
  await assertFits(page);
  await page.screenshot({
    path: testInfo.outputPath("registration-otp.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel(/Verification code/)).toBeEditable();
  await page.getByLabel(/Verification code/).fill("123456");
  await page.getByRole("button", { name: "Verify account" }).click();
  await expect(page).toHaveURL(/\/login\?verified=1/);
  await page.getByLabel(/^Password/).fill("OriginalPass123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  const oldSession = (await page.context().cookies()).find(
    (cookie) => cookie.name === "unicircle_session",
  )!.value;

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await assertFits(page);
  await page.getByLabel("CUET email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page).toHaveURL("/verify-otp?purpose=reset");
  await assertFits(page);
  await page.reload();
  await page.getByLabel(/Verification code/).fill("000000");
  await page.getByRole("button", { name: "Verify reset code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
  await page.getByLabel(/Verification code/).fill("123456");
  await page.getByRole("button", { name: "Verify reset code" }).click();
  await expect(page).toHaveURL("/reset-password");
  await assertFits(page);
  await page.screenshot({
    path: testInfo.outputPath("reset-password.png"),
    fullPage: true,
  });
  const cookies = await page.context().cookies();
  expect(
    cookies.find((cookie) => cookie.name === "unicircle_reset_grant")?.httpOnly,
  ).toBe(true);
  await page.reload();
  await page.getByLabel("New password", { exact: true }).fill("ChangedPass456");
  await page.getByLabel("Confirm new password").fill("DifferentPass123");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "do not match" }),
  ).toBeVisible();
  await page.getByLabel("Confirm new password").fill("ChangedPass456");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL("/login?reset=1");
  await expect(page.getByRole("status")).toContainText("Password changed");
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "unicircle_reset_grant",
    ),
  ).toBe(false);
  const stale = await page.request.get("/api/auth/me", {
    headers: { Cookie: `unicircle_session=${oldSession}` },
  });
  expect(stale.status()).toBe(401);
  await page.getByLabel(/Username or CUET email/).fill(email);
  await page.getByLabel(/^Password/).fill("OriginalPass123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "credentials are incorrect" }),
  ).toBeVisible();
  await page.getByLabel(/^Password/).fill("ChangedPass456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect((await page.request.get("/api/auth/me")).status()).toBe(200);
});

for (const width of [320, 390, 1366]) {
  test(`OTP and recovery controls remain visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/verify-otp?email=layout%40student.cuet.ac.bd");
    await expect(page.getByLabel(/Verification code/)).toBeVisible();
    await assertFits(page);
    await page.goto("/forgot-password");
    await expect(page.getByRole("button", { name: "Send reset code" })).toBeVisible();
    await assertFits(page);
  });
}
