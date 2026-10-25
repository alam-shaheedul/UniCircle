import type {
  AdminLoginInput,
  AuthenticationResult,
  GeneralLoginInput,
  EmailCodeResult,
  OtpVerificationInput,
  RegistrationInput,
  RegistrationResult,
} from "@/features/auth/types/auth";

export interface AuthService {
  register(input: RegistrationInput): Promise<RegistrationResult>;
  verifyOtp(input: OtpVerificationInput): Promise<void>;
  resendOtp(email: string): Promise<void>;
  loginGeneral(input: GeneralLoginInput): Promise<AuthenticationResult>;
  forgotPassword(email: string): Promise<EmailCodeResult>;
  verifyResetOtp(otp: string): Promise<{ verified: boolean }>;
  resendResetOtp(): Promise<EmailCodeResult>;
  resetPassword(password: string): Promise<void>;
  loginAdmin(input: AdminLoginInput): Promise<AuthenticationResult>;
}
