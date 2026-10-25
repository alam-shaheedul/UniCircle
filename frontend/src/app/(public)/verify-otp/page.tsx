import { AuthPage } from "@/features/auth/components/auth-page";
import { OtpVerificationForm } from "@/features/auth/components/otp-verification-form";
import { cookies } from "next/headers";
import {
  resetCodeCookie,
  readEmailFlowCookie,
} from "@/features/auth/lib/email-flow-cookie";

type VerifyOtpPageProps = Readonly<{
  searchParams: Promise<{ email?: string; purpose?: string; deliveryFailed?: string }>;
}>;

export default async function VerifyOtpPage({ searchParams }: VerifyOtpPageProps) {
  const params = await searchParams;
  const purpose = params.purpose === "reset" ? "reset" : "registration";
  const email =
    purpose === "registration"
      ? params.email
      : readEmailFlowCookie((await cookies()).get(resetCodeCookie)?.value)?.email;

  return (
    <AuthPage
      compactMobile
      eyebrow={purpose === "reset" ? "Password recovery" : "Email verification"}
      title="Check your inbox"
      description={
        purpose === "reset"
          ? "Verify your email code before choosing a new password."
          : "Enter your email code to activate your account."
      }
      panelTitle="A verified campus community."
      panelDescription="Institutional email verification keeps UniCircle focused on authentic CUET connections."
      panelItems={[
        "Six-digit email verification",
        "Expired and invalid-code feedback",
        "Safe resend cooldown",
      ]}
    >
      <OtpVerificationForm
        email={email}
        purpose={purpose}
        deliveryFailed={params.deliveryFailed === "1"}
      />
    </AuthPage>
  );
}
