import { authPolicy } from "@/features/auth/config/auth-policy";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9._-]+$/;

export type PasswordChecks = Readonly<{
  minimumLength: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
}>;

export function getPasswordChecks(password: string): PasswordChecks {
  return {
    minimumLength: password.length >= authPolicy.minimumPasswordLength,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}

export function validateUsername(username: string): string | undefined {
  const value = username.trim();

  if (!value) {
    return "Username is required.";
  }

  if (value.length < 3) {
    return "Username must contain at least 3 characters.";
  }

  if (!usernamePattern.test(value)) {
    return "Use letters, numbers, dots, underscores, or hyphens only.";
  }

  return undefined;
}

export function validateCuetEmail(email: string): string | undefined {
  const value = email.trim().toLowerCase();

  if (!value) {
    return "CUET email is required.";
  }

  if (!emailPattern.test(value)) {
    return "Enter a valid email address.";
  }

  const domain = value.slice(value.lastIndexOf("@") + 1);

  if (!authPolicy.cuetEmailDomains.some((allowedDomain) => domain === allowedDomain)) {
    return "Use your @cuet.ac.bd or @student.cuet.ac.bd email address.";
  }

  return undefined;
}

export function validateRequired(value: string, label: string): string | undefined {
  return value.trim() ? undefined : `${label} is required.`;
}

export function validateOtp(otp: string): string | undefined {
  if (!otp) {
    return "Enter the verification code.";
  }

  if (!new RegExp(`^\\d{${authPolicy.otpLength}}$`).test(otp)) {
    return `Enter the ${authPolicy.otpLength}-digit verification code.`;
  }

  return undefined;
}
