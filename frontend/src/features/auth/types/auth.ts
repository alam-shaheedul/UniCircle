import type { SessionUser } from "@/features/auth/types/session-user";
import type { UserRole } from "@/types/common";

export type GeneralUserRole = Exclude<UserRole, "admin">;

export type RegistrationInput = Readonly<{
  firstName: string;
  lastName: string;
  homeAddress: string;
  username: string;
  email: string;
  password: string;
  role: GeneralUserRole;
  universityId: string;
}>;

export type RegistrationResult = Readonly<{
  email: string;
}>;

export type OtpVerificationInput = Readonly<{
  email: string;
  otp: string;
}>;

export type GeneralLoginInput = Readonly<{
  identifier: string;
  password: string;
}>;

export type AdminLoginInput = Readonly<{
  adminId: string;
  password: string;
}>;

export type AuthenticationResult = Readonly<{
  user: SessionUser;
}>;

export type EmailCodeResult = Readonly<{
  flow: "reset";
  email: string;
  expiresAt?: string;
}>;

export type OtpPurpose = "registration" | "reset";
