import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GeneralLoginForm } from "@/features/auth/components/general-login-form";
import { OtpVerificationForm } from "@/features/auth/components/otp-verification-form";
import { RegistrationForm } from "@/features/auth/components/registration-form";
import { PasswordRecoveryForm } from "@/features/auth/components/password-recovery-form";
import {
  isPasswordValid,
  validateCuetEmail,
  validateOtp,
  validateUsername,
} from "@/features/auth/lib/auth-validation";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  register: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
  loginGeneral: vi.fn(),
  forgotPassword: vi.fn(),
  verifyResetOtp: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/services", () => ({
  authService: {
    register: mocks.register,
    verifyOtp: mocks.verifyOtp,
    resendOtp: mocks.resendOtp,
    loginGeneral: mocks.loginGeneral,
    forgotPassword: mocks.forgotPassword,
    verifyResetOtp: mocks.verifyResetOtp,
    resetPassword: mocks.resetPassword,
  },
}));

describe("authentication validation", () => {
  test("accepts only CUET domains and enforces registration rules", () => {
    expect(validateCuetEmail("u2204067@student.cuet.ac.bd")).toBeUndefined();
    expect(validateCuetEmail("teacher@cuet.ac.bd")).toBeUndefined();
    expect(validateCuetEmail("student@gmail.com")).toMatch(/@cuet\.ac\.bd/);
    expect(validateUsername("a")).toMatch(/at least 3/);
    expect(isPasswordValid("StrongPass123")).toBe(true);
    expect(isPasswordValid("weak")).toBe(false);
    expect(validateOtp("123456")).toBeUndefined();
    expect(validateOtp("123")).toMatch(/6-digit/);
  });
});

describe("authentication forms", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.register.mockReset();
    mocks.verifyOtp.mockReset();
    mocks.resendOtp.mockReset();
    mocks.loginGeneral.mockReset();
    mocks.replace.mockReset();
    mocks.forgotPassword.mockReset();
    mocks.verifyResetOtp.mockReset();
    mocks.resetPassword.mockReset();
  });

  test("registration presents validation and switches the role-specific ID", async () => {
    const user = userEvent.setup();
    render(<RegistrationForm />);

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("First name is required.")).toBeVisible();
    expect(screen.getByText("CUET email is required.")).toBeVisible();

    const idInput = screen.getByLabelText(/Student ID/);
    await user.type(idInput, "2204001");
    await user.click(screen.getByLabelText("Teacher"));
    expect(screen.getByLabelText(/Teacher ID/)).toHaveValue("");

    await user.type(screen.getByLabelText(/CUET email/), "user@gmail.com");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText(
        "Use your @cuet.ac.bd or @student.cuet.ac.bd email address.",
      ),
    ).toBeVisible();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  test("OTP form validates and submits the six-digit code", async () => {
    const user = userEvent.setup();
    mocks.verifyOtp.mockResolvedValue(undefined);
    render(<OtpVerificationForm email="u2204067@student.cuet.ac.bd" />);

    await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(await screen.findByText("Enter the verification code.")).toBeVisible();

    await user.type(screen.getByLabelText(/Verification code/), "123456");
    await user.click(screen.getByRole("button", { name: "Verify account" }));
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "u2204067@student.cuet.ac.bd",
      otp: "123456",
    });
    expect(mocks.push).toHaveBeenCalledWith(
      "/login?verified=1&email=u2204067%40student.cuet.ac.bd",
    );
  });

  test("login form exposes verified state and rejects blank credentials", async () => {
    const user = userEvent.setup();
    render(<GeneralLoginForm registrationVerified />);

    expect(screen.getByRole("status")).toHaveTextContent("email is verified");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Username or email is required.")).toBeVisible();
    expect(screen.getByText("Password is required.")).toBeVisible();
    expect(mocks.loginGeneral).not.toHaveBeenCalled();
  });

  test("login offers password recovery", () => {
    render(<GeneralLoginForm />);
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  test("forgot password validates institutional email and opens reset OTP", async () => {
    const user = userEvent.setup();
    mocks.forgotPassword.mockResolvedValue({ flow: "reset" });
    render(<PasswordRecoveryForm />);
    await user.type(screen.getByLabelText("CUET email"), "student@gmail.com");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));
    expect(mocks.forgotPassword).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("CUET email"));
    await user.type(screen.getByLabelText("CUET email"), "student@student.cuet.ac.bd");
    await user.click(screen.getByRole("button", { name: "Send reset code" }));
    expect(mocks.push).toHaveBeenCalledWith("/verify-otp?purpose=reset");
  });

  test("reset code is verified before navigating to the new-password form", async () => {
    const user = userEvent.setup();
    mocks.verifyResetOtp.mockResolvedValue({ verified: true });
    render(<OtpVerificationForm email="student@student.cuet.ac.bd" purpose="reset" />);
    await user.type(screen.getByLabelText(/Verification code/), "123456");
    await user.click(screen.getByRole("button", { name: "Verify reset code" }));
    expect(mocks.verifyResetOtp).toHaveBeenCalledWith("123456");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/reset-password");
  });

  test("new password must meet policy and match confirmation", async () => {
    const user = userEvent.setup();
    mocks.resetPassword.mockResolvedValue(undefined);
    render(<PasswordRecoveryForm reset />);
    await user.type(
      screen.getByLabelText("New password", { exact: true }),
      "ChangedPass123",
    );
    await user.type(screen.getByLabelText("Confirm new password"), "DifferentPass123");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeVisible();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("Confirm new password"), "ChangedPass123");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(mocks.resetPassword).toHaveBeenCalledWith("ChangedPass123");
    expect(mocks.replace).toHaveBeenCalledWith("/login?reset=1");
  });
});
