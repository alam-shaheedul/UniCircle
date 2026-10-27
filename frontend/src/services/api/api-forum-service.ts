import type {
  ForumComment,
  ForumPost,
  ForumSnapshot,
} from "@/features/forum/types/forum";
import type { ForumService } from "@/services/contracts/forum-service";
import { ServiceError } from "@/services/errors/service-error";

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("unicircle_csrf="));
  return value ? decodeURIComponent(value.slice("unicircle_csrf=".length)) : "";
}

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/forum/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach the community forum.", "network", {
      cause,
    });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result)) {
    throw new ServiceError(
      result?.error?.message ?? "Community forum request failed.",
      response.status === 409 ? "conflict" : "unknown",
    );
  }
  return result.data as T;
}

export class ApiForumService implements ForumService {
  async getSnapshot(token?: string): Promise<ForumSnapshot> {
    return request<ForumSnapshot>("forum/posts?limit=100", "GET", undefined, token);
  }

  async createPost(body: string): Promise<ForumPost> {
    return request<ForumPost>("forum/posts", "POST", { body });
  }

  async createComment(postId: string, body: string): Promise<ForumComment> {
    return request<ForumComment>(`forum/posts/${postId}/comments`, "POST", { body });
  }

  async reportPost(postId: string, reason: string): Promise<void> {
    await request(`forum/posts/${postId}/reports`, "POST", { reason });
  }
}
