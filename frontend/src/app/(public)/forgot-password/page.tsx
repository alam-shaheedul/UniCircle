import { AuthPage } from "@/features/auth/components/auth-page";
import { PasswordRecoveryForm } from "@/features/auth/components/password-recovery-form";

export default function ForgotPasswordPage() {
  return (
    <AuthPage
      compactMobile
      eyebrow="Password recovery"
      title="Forgot your password?"
      description="We will send a verification code to your registered CUET email."
      panelTitle="A safe way back to campus."
      panelDescription="Verify your email, choose a new password, then sign in again."
      panelItems={[
        "Email verification before any password change",
        "Expiring, single-use reset codes",
        "Existing sessions signed out after reset",
      ]}
    >
      <PasswordRecoveryForm />
    </AuthPage>
  );
}
