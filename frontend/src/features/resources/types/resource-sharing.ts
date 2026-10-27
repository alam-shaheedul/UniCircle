export const resourceCategories = [
  { id: "notebook", label: "Notebook" },
  { id: "lab-report", label: "Lab report" },
  { id: "t-scale", label: "T-scale" },
  { id: "bicycle", label: "Bicycle" },
  { id: "other", label: "Other approved resource" },
] as const;

export type ResourceCategory = (typeof resourceCategories)[number]["id"];
export type ResourceRequestStatus = "pending" | "accepted" | "rejected";

export type ResourcePerson = Readonly<{
  id: string;
  name: string;
  username: string;
  department: string;
  level: string;
  hall: string;
  availabilityNote: string;
  resourceCategories: readonly ResourceCategory[];
}>;

export type ResourceProfile = Readonly<{
  isDiscoverable: boolean;
  level: string;
  hall: string;
  availabilityNote: string;
  resourceCategories: readonly ResourceCategory[];
}>;

export type ResourceRequest = Readonly<{
  id: string;
  senderId: string;
  receiverId: string;
  category: ResourceCategory;
  resourceName: string;
  message: string;
  status: ResourceRequestStatus;
  createdAt: string;
}>;

export type ResourceConversation = Readonly<{
  id: string;
  requestId: string;
  otherUserId: string;
  otherUserName: string;
  resourceName: string;
  lastActivityAt: string;
}>;

export type ResourceMessage = Readonly<{
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  sentAt: string;
}>;

export type ResourceSharingSnapshot = Readonly<{
  currentUserId: string;
  profile: ResourceProfile;
  people: readonly ResourcePerson[];
  requests: readonly ResourceRequest[];
  conversations: readonly ResourceConversation[];
  messages: readonly ResourceMessage[];
  loadError?: string;
}>;

export type NewResourceRequest = Readonly<{
  receiverId: string;
  category: ResourceCategory;
  resourceName: string;
  message: string;
}>;
