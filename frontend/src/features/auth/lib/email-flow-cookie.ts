import "server-only";

export const resetCodeCookie = "unicircle_reset_code";
export const resetGrantCookie = "unicircle_reset_grant";

export function readEmailFlowCookie(
  value?: string,
): { challengeId: string; email: string } | null {
  try {
    const data = JSON.parse(value ?? "null");
    return data &&
      typeof data.challengeId === "string" &&
      typeof data.email === "string"
      ? { challengeId: data.challengeId, email: data.email }
      : null;
  } catch {
    return null;
  }
}
