"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { FormError } from "@/components/ui/forms/form-error";
import { routes } from "@/config/routes";
import { getAuthErrorMessage } from "@/features/auth/lib/auth-error";
import { validateRequired } from "@/features/auth/lib/auth-validation";
import { authService } from "@/services";

import styles from "./auth.module.css";

export function AdminLoginForm() {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [adminIdError, setAdminIdError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const nextAdminIdError = validateRequired(adminId, "Admin ID");
    const nextPasswordError = validateRequired(password, "Password");
    setAdminIdError(nextAdminIdError ?? null);
    setPasswordError(nextPasswordError ?? null);
    if (nextAdminIdError || nextPasswordError) return;

    setIsSubmitting(true);
    try {
      await authService.loginAdmin({ adminId: adminId.trim(), password });
      window.location.assign(routes.admin);
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {formError ? <div className={styles.formAlert}>{formError}</div> : null}

        <div className={styles.field}>
          <label htmlFor="admin-id">
            Admin ID <span aria-hidden="true">*</span>
          </label>
          <input
            id="admin-id"
            name="adminId"
            autoComplete="username"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
            aria-invalid={Boolean(adminIdError)}
            aria-describedby={adminIdError ? "admin-id-error" : undefined}
          />
          <FormError id="admin-id-error" message={adminIdError} />
        </div>

        <div className={styles.field}>
          <label htmlFor="admin-password">
            Password <span aria-hidden="true">*</span>
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "admin-password-error" : undefined}
          />
          <FormError id="admin-password-error" message={passwordError} />
        </div>

        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Checking access..." : "Access Admin portal"}
        </button>
      </form>

      <p className={styles.formFooter}>
        General User? <Link href={routes.auth.login}>Return to user login</Link>
      </p>
    </>
  );
}
