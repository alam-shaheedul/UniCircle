import type {
  AdminLoginInput,
  AuthenticationResult,
  GeneralLoginInput,
  EmailCodeResult,
  OtpVerificationInput,
  RegistrationInput,
  RegistrationResult,
} from "@/features/auth/types/auth";
import type {
  GeneralSessionUser,
  SessionUser,
} from "@/features/auth/types/session-user";
import type { AuthService } from "@/services/contracts/auth-service";
import { ServiceError } from "@/services/errors/service-error";

type Envelope<T> = { data: T };
type ErrorEnvelope = { error?: { code?: string; message?: string } };

export function normalizeSessionUser(user: SessionUser): SessionUser {
  if (user.role === "admin") return user;
  const raw = user as GeneralSessionUser & {
    department: string | null;
    phone: string | null;
    bio: string | null;
  };
  return {
    ...raw,
    department: raw.department ?? "",
    phone: raw.phone ?? "",
    bio: raw.bio ?? "",
  };
}

export async function authRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  headers?: HeadersInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    throw new ServiceError("Cannot reach the authentication service.", "network", {
      cause: error,
    });
  }
  if (response.status === 204) return undefined as T;
  const result: Envelope<T> & ErrorEnvelope = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ServiceError(
      result.error?.message ?? "Authentication request failed.",
      response.status === 401
        ? "invalid-credentials"
        : response.status === 409
          ? "conflict"
          : result.error?.code === "expired_otp"
            ? "expired-otp"
            : result.error?.code === "email_unavailable"
              ? "email-unavailable"
              : result.error?.code === "invalid_otp"
                ? "invalid-otp"
                : "unknown",
    );
  }
  return result.data;
}

export class ApiAuthService implements AuthService {
  register(input: RegistrationInput): Promise<RegistrationResult> {
    return authRequest("register", "POST", input);
  }

  verifyOtp(input: OtpVerificationInput): Promise<void> {
    return authRequest("verify-otp", "POST", input);
  }

  resendOtp(email: string): Promise<void> {
    return authRequest("resend-otp", "POST", { email });
  }

  loginGeneral(input: GeneralLoginInput): Promise<AuthenticationResult> {
    return authRequest<AuthenticationResult>("login", "POST", input).then(
      ({ user }) => ({ user: normalizeSessionUser(user) }),
    );
  }

  forgotPassword(email: string): Promise<EmailCodeResult> {
    return authRequest("forgot-password", "POST", { email });
  }

  verifyResetOtp(otp: string): Promise<{ verified: boolean }> {
    return authRequest("password-reset/verify-otp", "POST", { otp });
  }

  resendResetOtp(): Promise<EmailCodeResult> {
    return authRequest("password-reset/resend-otp", "POST", {});
  }

  resetPassword(password: string): Promise<void> {
    return authRequest("reset-password", "POST", { password });
  }

  loginAdmin(input: AdminLoginInput): Promise<AuthenticationResult> {
    return authRequest<AuthenticationResult>("admin/login", "POST", input).then(
      ({ user }) => ({ user: normalizeSessionUser(user) }),
    );
  }
}
