import { AdminLoginForm } from "@/features/auth/components/admin-login-form";
import { AuthPage } from "@/features/auth/components/auth-page";

export default function AdminLoginPage() {
  return (
    <AuthPage
      admin
      eyebrow="Authorized personnel"
      title="Admin portal"
      description="Sign in with your assigned Admin ID to manage UniCircle operations."
      panelTitle="Campus operations, protected."
      panelDescription="Administrative access is separate from General User accounts and is not available through public registration."
      panelItems={[
        "Dedicated administrative session",
        "Role-gated Admin navigation",
        "Direct access to the Admin workspace",
      ]}
    >
      <AdminLoginForm />
    </AuthPage>
  );
}
