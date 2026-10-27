import type { AppNotification } from "@/features/notifications/types/notification";
import type { NotificationService } from "@/services/contracts/notification-service";
import { ServiceError } from "@/services/errors/service-error";

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("unicircle_csrf="));
  return value ? decodeURIComponent(value.slice("unicircle_csrf=".length)) : "";
}

async function request<T>(path: string, method = "GET", token?: string): Promise<T> {
  const jsonMutation = method !== "GET" && method !== "DELETE";
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/club-events/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(jsonMutation ? { "Content-Type": "application/json" } : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach notification services.", "network", {
      cause,
    });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result)) {
    throw new ServiceError(result?.error?.message ?? "Notification request failed.");
  }
  return result.data as T;
}

export class ApiNotificationService implements NotificationService {
  async list(token?: string): Promise<readonly AppNotification[]> {
    return request<AppNotification[]>("notifications/me", "GET", token);
  }

  async markAsRead(id: string): Promise<void> {
    await request(`notifications/${id}/read`, "PUT");
  }

  async markAllAsRead(): Promise<void> {
    await request("notifications/read-all", "PUT");
  }
}
