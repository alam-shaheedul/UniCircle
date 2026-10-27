import type {
  NewResourceRequest,
  ResourceCategory,
  ResourceConversation,
  ResourceMessage,
  ResourcePerson,
  ResourceProfile,
  ResourceRequest,
  ResourceRequestStatus,
  ResourceSharingSnapshot,
} from "@/features/resources/types/resource-sharing";
import type { ResourceSharingService } from "@/services/contracts/resource-sharing-service";
import { ServiceError } from "@/services/errors/service-error";

type List<T> = { items: T[]; total: number };
type ProfileRecord = {
  isDiscoverable: boolean;
  level: string | null;
  hall: string | null;
  availabilityNote: string | null;
  categories: ResourceCategory[];
};
type PersonRecord = ProfileRecord & {
  userId: string;
  name: string;
  username: string;
  department: string;
};
type RequestRecord = {
  id: string;
  requesterId: string;
  recipientId: string;
  category: ResourceCategory;
  resourceName: string;
  description: string;
  status: ResourceRequestStatus;
  createdAt: string;
};
type ConversationRecord = ResourceConversation;

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("unicircle_csrf="));
  return value ? decodeURIComponent(value.slice("unicircle_csrf=".length)) : "";
}

async function requestData<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/resource-sharing/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach resource sharing.", "network", { cause });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result)) {
    throw new ServiceError(
      result?.error?.message ?? "Resource sharing request failed.",
      response.status === 401 ? "unauthorized" : "unknown",
    );
  }
  return result.data as T;
}

function mapProfile(record: ProfileRecord): ResourceProfile {
  return {
    isDiscoverable: record.isDiscoverable,
    level: record.level ?? "",
    hall: record.hall ?? "",
    availabilityNote: record.availabilityNote ?? "",
    resourceCategories: record.categories,
  };
}

function mapPerson(record: PersonRecord): ResourcePerson {
  return {
    id: record.userId,
    name: record.name,
    username: record.username,
    department: record.department,
    ...mapProfile(record),
  };
}

function mapRequest(record: RequestRecord): ResourceRequest {
  return {
    id: record.id,
    senderId: record.requesterId,
    receiverId: record.recipientId,
    category: record.category,
    resourceName: record.resourceName,
    message: record.description,
    status: record.status,
    createdAt: record.createdAt,
  };
}

export class ApiResourceSharingService implements ResourceSharingService {
  async getSnapshot(
    currentUserId: string,
    token?: string,
  ): Promise<ResourceSharingSnapshot> {
    const [profile, people, requests, conversations] = await Promise.all([
      requestData<ProfileRecord>("resource-profile/me", "GET", undefined, token),
      requestData<List<PersonRecord>>(
        "users/discover?limit=100",
        "GET",
        undefined,
        token,
      ),
      requestData<List<RequestRecord>>(
        "resource-requests/mine?limit=100",
        "GET",
        undefined,
        token,
      ),
      requestData<List<ConversationRecord>>(
        "conversations?limit=100",
        "GET",
        undefined,
        token,
      ),
    ]);
    return {
      currentUserId,
      profile: mapProfile(profile),
      people: people.items.map(mapPerson),
      requests: requests.items.map(mapRequest),
      conversations: conversations.items,
      messages: [],
    };
  }

  async saveProfile(profile: ResourceProfile): Promise<void> {
    await requestData("resource-profile/me", "PATCH", {
      is_discoverable: profile.isDiscoverable,
      level: profile.level || null,
      hall: profile.hall || null,
      availability_note: profile.availabilityNote || null,
      categories: profile.resourceCategories,
    });
  }

  async submitRequest(request: NewResourceRequest): Promise<void> {
    await requestData("resource-requests", "POST", {
      recipient_id: request.receiverId,
      category: request.category,
      resource_name: request.resourceName,
      description: request.message,
    });
  }

  async decideRequest(
    requestId: string,
    status: Exclude<ResourceRequestStatus, "pending">,
  ): Promise<void> {
    await requestData(`resource-requests/${requestId}/decision`, "POST", {
      decision: status,
    });
  }

  async getMessages(conversationId: string, beforeId?: string) {
    const query = beforeId ? `?before_id=${encodeURIComponent(beforeId)}` : "";
    return requestData<{ items: ResourceMessage[]; hasMore: boolean }>(
      `conversations/${conversationId}/messages${query}`,
    );
  }

  async sendMessage(conversationId: string, body: string): Promise<ResourceMessage> {
    return requestData<ResourceMessage>(
      `conversations/${conversationId}/messages`,
      "POST",
      { body },
    );
  }
}
