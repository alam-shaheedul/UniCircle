import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { AuthPage } from "@/features/auth/components/auth-page";
import { PasswordRecoveryForm } from "@/features/auth/components/password-recovery-form";
import { resetGrantCookie } from "@/features/auth/lib/email-flow-cookie";

export default async function ResetPasswordPage() {
  // Presence is a UX guard only. The API validates the live, single-use grant.
  if (!(await cookies()).has(resetGrantCookie)) redirect(routes.auth.forgotPassword);
  return (
    <AuthPage
      compactMobile
      eyebrow="Email verified"
      title="Choose a new password"
      description="Set a strong password. You will sign in again after saving it."
      panelTitle="A fresh start, securely."
      panelDescription="Your old password and existing sessions stop working once your new password is saved."
      panelItems={[
        "At least eight characters",
        "Uppercase, lowercase, and a number",
        "Reset permission expires in ten minutes",
      ]}
    >
      <PasswordRecoveryForm reset />
    </AuthPage>
  );
}
