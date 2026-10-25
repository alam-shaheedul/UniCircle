import { AuthPage } from "@/features/auth/components/auth-page";
import { GeneralLoginForm } from "@/features/auth/components/general-login-form";

type LoginPageProps = Readonly<{
  searchParams: Promise<{ verified?: string; email?: string; reset?: string }>;
}>;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { verified, email, reset } = await searchParams;

  return (
    <AuthPage
      eyebrow="Welcome back"
      title="Sign in to UniCircle"
      description="Use your username or CUET email to continue to the campus platform."
      panelTitle="Your campus, always connected."
      panelDescription="Return to your personalized CUET hub for community updates, navigation, and collaboration."
      panelItems={[
        "Campus-wide information in one place",
        "Personalized notifications and updates",
        "Secure role-aware navigation",
      ]}
    >
      <GeneralLoginForm
        initialIdentifier={email}
        registrationVerified={verified === "1"}
        passwordReset={reset === "1"}
      />
    </AuthPage>
  );
}
