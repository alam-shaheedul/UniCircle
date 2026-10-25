import type { CampusAssistantReply } from "@/features/assistant/types/campus-assistant";
import type { CampusAssistantService } from "@/services/contracts/campus-assistant-service";
import { ServiceError } from "@/services/errors/service-error";

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("unicircle_csrf="));
  return value ? decodeURIComponent(value.slice("unicircle_csrf=".length)) : "";
}

export class ApiCampusAssistantService implements CampusAssistantService {
  async ask(question: string): Promise<CampusAssistantReply> {
    let response: Response;
    try {
      response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
        },
        body: JSON.stringify({ question }),
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(190_000),
      });
    } catch (cause) {
      throw new ServiceError("Cannot reach the Campus AI Assistant.", "network", {
        cause,
      });
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || !("data" in result)) {
      throw new ServiceError(
        result?.error?.message ?? "Campus assistant request failed.",
      );
    }
    return result.data as CampusAssistantReply;
  }
}
