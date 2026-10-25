"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { FormError } from "@/components/ui/forms/form-error";
import { routes } from "@/config/routes";
import { authPolicy } from "@/features/auth/config/auth-policy";
import { getAuthErrorMessage } from "@/features/auth/lib/auth-error";
import { validateOtp } from "@/features/auth/lib/auth-validation";
import type { OtpPurpose } from "@/features/auth/types/auth";
import { authService } from "@/services";

import styles from "./auth.module.css";

type OtpVerificationFormProps = Readonly<{
  email?: string;
  purpose?: OtpPurpose;
  deliveryFailed?: boolean;
}>;

export function OtpVerificationForm({
  email,
  purpose = "registration",
  deliveryFailed = false,
}: OtpVerificationFormProps) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState<number>(
    deliveryFailed ? 0 : authPolicy.otpResendCooldownSeconds,
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setStatusMessage(null);
    const nextError = validateOtp(otp);
    setOtpError(nextError ?? null);
    if (nextError || !email) return;

    setIsSubmitting(true);
    try {
      if (purpose === "reset") {
        await authService.verifyResetOtp(otp);
        router.push(routes.auth.resetPassword);
      } else {
        await authService.verifyOtp({ email, otp });
        router.push(
          `${routes.auth.login}?verified=1&email=${encodeURIComponent(email)}`,
        );
      }
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0 || isResending) return;
    setFormError(null);
    setStatusMessage(null);
    setIsResending(true);
    try {
      if (purpose === "reset") await authService.resendResetOtp();
      else await authService.resendOtp(email);
      setOtp("");
      setOtpError(null);
      setCooldown(authPolicy.otpResendCooldownSeconds);
      setStatusMessage(
        "If your account is eligible, a new code will be sent. Check your inbox and spam folder.",
      );
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <>
      {email ? (
        <div className={styles.emailTarget}>
          <span>{purpose === "reset" ? "Recovery email" : "Your CUET email"}</span>
          <strong>{email}</strong>
        </div>
      ) : (
        <div className={styles.formAlert} role="alert">
          This verification request has expired or is missing. Please start again.
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {deliveryFailed ? (
          <div className={styles.formAlert} role="alert">
            Your account was created, but the email could not be sent. Use Resend code
            to try again.
          </div>
        ) : null}
        {formError ? (
          <div className={styles.formAlert} role="alert">
            {formError}
          </div>
        ) : null}
        {statusMessage ? (
          <div className={styles.formSuccess} role="status">
            {statusMessage}
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="otp">
            Verification code <span aria-hidden="true">*</span>
          </label>
          <input
            className={styles.otpInput}
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            enterKeyHint="done"
            autoFocus
            maxLength={authPolicy.otpLength}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(otpError)}
            aria-describedby="otp-error otp-hint"
            disabled={!email}
          />
          <FormError id="otp-error" message={otpError} />
        </div>

        <p className={styles.otpHint} id="otp-hint">
          {purpose === "reset"
            ? "If this email belongs to an active account, you will receive a six-digit code. "
            : "Enter the six-digit code sent to your CUET email. "}
          Check spam too. Codes expire after 10 minutes.
        </p>

        <button
          className={styles.submitButton}
          type="submit"
          disabled={isSubmitting || !email}
        >
          {isSubmitting
            ? "Verifying..."
            : purpose === "reset"
              ? "Verify reset code"
              : "Verify account"}
        </button>

        <div className={styles.resendRow}>
          <span>Did not receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={!email || cooldown > 0 || isResending}
          >
            {isResending
              ? "Sending..."
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
          </button>
        </div>
      </form>

      <p className={styles.formFooter}>
        <Link
          href={
            purpose === "registration"
              ? routes.auth.register
              : routes.auth.forgotPassword
          }
        >
          Start again
        </Link>
      </p>
    </>
  );
}
