import type {
  NewResourceRequest,
  ResourceMessage,
  ResourceProfile,
  ResourceRequestStatus,
  ResourceSharingSnapshot,
} from "@/features/resources/types/resource-sharing";

export interface ResourceSharingService {
  getSnapshot(currentUserId: string, token?: string): Promise<ResourceSharingSnapshot>;
  saveProfile(profile: ResourceProfile): Promise<void>;
  submitRequest(request: NewResourceRequest): Promise<void>;
  decideRequest(
    requestId: string,
    status: Exclude<ResourceRequestStatus, "pending">,
  ): Promise<void>;
  getMessages(
    conversationId: string,
    beforeId?: string,
  ): Promise<{
    items: ResourceMessage[];
    hasMore: boolean;
  }>;
  sendMessage(conversationId: string, body: string): Promise<ResourceMessage>;
}
