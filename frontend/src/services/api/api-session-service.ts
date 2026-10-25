import type { SessionUser } from "@/features/auth/types/session-user";
import { authRequest, normalizeSessionUser } from "@/services/api/api-auth-service";
import type { SessionService } from "@/services/contracts/session-service";
import { ServiceError } from "@/services/errors/service-error";

function readCsrfCookie(): string {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith("unicircle_csrf="));
  return entry ? decodeURIComponent(entry.slice("unicircle_csrf=".length)) : "";
}

export class ApiSessionService implements SessionService {
  async getCurrentUser(): Promise<SessionUser | null> {
    try {
      return normalizeSessionUser(await authRequest<SessionUser>("me", "GET"));
    } catch (error) {
      if (error instanceof ServiceError && error.code === "invalid-credentials") {
        return null;
      }
      throw error;
    }
  }

  logout(): Promise<void> {
    return authRequest("logout", "POST", undefined, {
      "X-CSRF-Token": readCsrfCookie(),
    });
  }
}
