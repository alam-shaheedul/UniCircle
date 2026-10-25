"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { FormError } from "@/components/ui/forms/form-error";
import { routes } from "@/config/routes";
import { getAuthErrorMessage } from "@/features/auth/lib/auth-error";
import {
  isPasswordValid,
  validateCuetEmail,
} from "@/features/auth/lib/auth-validation";
import { authService } from "@/services";

import { PasswordRequirements } from "./password-requirements";
import styles from "./auth.module.css";

export function PasswordRecoveryForm({ reset = false }: Readonly<{ reset?: boolean }>) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmation?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const nextErrors = reset
      ? {
          password: isPasswordValid(password)
            ? undefined
            : "Password does not meet all requirements.",
          confirmation:
            password === confirmation ? undefined : "Passwords do not match.",
        }
      : { email: validateCuetEmail(email) };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setBusy(true);
    try {
      if (reset) {
        await authService.resetPassword(password);
        setPassword("");
        setConfirmation("");
        router.replace(`${routes.auth.login}?reset=1`);
      } else {
        await authService.forgotPassword(email.trim().toLowerCase());
        router.push(`${routes.auth.verifyOtp}?purpose=reset`);
      }
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={submit} noValidate>
        {formError ? (
          <div className={styles.formAlert} role="alert">
            {formError}
          </div>
        ) : null}
        {reset ? (
          <>
            <div className={styles.field}>
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby="new-password-error"
              />
              <FormError id="new-password-error" message={errors.password} />
              <PasswordRequirements password={password} />
            </div>
            <div className={styles.field}>
              <label htmlFor="confirm-new-password">Confirm new password</label>
              <input
                id="confirm-new-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                aria-invalid={Boolean(errors.confirmation)}
                aria-describedby="confirm-new-password-error"
              />
              <FormError
                id="confirm-new-password-error"
                message={errors.confirmation}
              />
            </div>
          </>
        ) : (
          <div className={styles.field}>
            <label htmlFor="recovery-email">CUET email</label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="your-id@student.cuet.ac.bd"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby="recovery-email-error recovery-hint"
            />
            <FormError id="recovery-email-error" message={errors.email} />
            <p className={styles.fieldHint} id="recovery-hint">
              If this address belongs to an active account, we will email a reset code.
              Check your inbox and spam folder.
            </p>
          </div>
        )}
        <button className={styles.submitButton} type="submit" disabled={busy}>
          {busy
            ? reset
              ? "Saving password..."
              : "Sending code..."
            : reset
              ? "Set new password"
              : "Send reset code"}
        </button>
      </form>
      <p className={styles.formFooter}>
        <Link href={routes.auth.login}>Back to sign in</Link>
        {reset ? (
          <>
            {" "}
            · <Link href={routes.auth.forgotPassword}>Request a new code</Link>
          </>
        ) : null}
      </p>
    </>
  );
}
