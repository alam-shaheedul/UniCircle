export const authPolicy = Object.freeze({
  cuetEmailDomains: ["cuet.ac.bd", "student.cuet.ac.bd"] as const,
  minimumPasswordLength: 8,
  otpLength: 6,
  otpResendCooldownSeconds: 60,
});
