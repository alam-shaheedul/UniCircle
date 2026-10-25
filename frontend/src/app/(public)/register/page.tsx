import { AuthPage } from "@/features/auth/components/auth-page";
import { RegistrationForm } from "@/features/auth/components/registration-form";

export default function RegistrationPage() {
  return (
    <AuthPage
      eyebrow="Join the campus network"
      title="Create your account"
      description="Register with your institutional identity to join the CUET community."
      panelTitle="One campus. One circle."
      panelDescription="Use UniCircle to discover people, places, events, resources, and updates across CUET."
      panelItems={[
        "Verified CUET community access",
        "Role-specific campus identity",
        "One account for every UniCircle feature",
      ]}
    >
      <RegistrationForm />
    </AuthPage>
  );
}
