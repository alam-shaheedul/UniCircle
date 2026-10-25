"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { FormError } from "@/components/ui/forms/form-error";
import { routes } from "@/config/routes";
import { getAuthErrorMessage } from "@/features/auth/lib/auth-error";
import { validateRequired } from "@/features/auth/lib/auth-validation";
import { authService } from "@/services";

import styles from "./auth.module.css";

type GeneralLoginFormProps = Readonly<{
  initialIdentifier?: string;
  registrationVerified?: boolean;
  passwordReset?: boolean;
}>;

export function GeneralLoginForm({
  initialIdentifier = "",
  registrationVerified = false,
  passwordReset = false,
}: GeneralLoginFormProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const nextIdentifierError = validateRequired(identifier, "Username or email");
    const nextPasswordError = validateRequired(password, "Password");
    setIdentifierError(nextIdentifierError ?? null);
    setPasswordError(nextPasswordError ?? null);
    if (nextIdentifierError || nextPasswordError) return;

    setIsSubmitting(true);
    try {
      await authService.loginGeneral({
        identifier: identifier.trim(),
        password,
      });
      window.location.assign(routes.home);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {registrationVerified ? (
          <div className={styles.formSuccess} role="status">
            Your CUET email is verified. You can now sign in.
          </div>
        ) : null}
        {passwordReset ? (
          <div className={styles.formSuccess} role="status">
            Password changed. Sign in with your new password.
          </div>
        ) : null}
        {formError ? (
          <div className={styles.formAlert} role="alert">
            {formError}
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="identifier">
            Username or CUET email <span aria-hidden="true">*</span>
          </label>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            aria-invalid={Boolean(identifierError)}
            aria-describedby={identifierError ? "identifier-error" : undefined}
          />
          <FormError id="identifier-error" message={identifierError} />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "login-password-error" : undefined}
          />
          <FormError id="login-password-error" message={passwordError} />
        </div>

        <Link className={styles.inlineLink} href={routes.auth.forgotPassword}>
          Forgot password?
        </Link>

        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className={styles.formFooter}>
        New to UniCircle? <Link href={routes.auth.register}>Create an account</Link>
      </p>
    </>
  );
}
