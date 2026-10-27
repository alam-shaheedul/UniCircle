"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  NewResourceRequest,
  ResourceConversation,
  ResourceMessage,
  ResourcePerson,
  ResourceProfile,
  ResourceRequest,
  ResourceRequestStatus,
  ResourceSharingSnapshot,
} from "@/features/resources/types/resource-sharing";
import { resourceSharingService } from "@/services";

type ResourceSharingContextValue = Readonly<{
  currentUserId: string;
  profile: ResourceProfile;
  people: readonly ResourcePerson[];
  requests: readonly ResourceRequest[];
  conversations: readonly ResourceConversation[];
  messages: readonly ResourceMessage[];
  hasOlderMessages: Readonly<Record<string, boolean>>;
  error: string | null;
  saveProfile: (profile: ResourceProfile) => Promise<boolean>;
  submitRequest: (request: NewResourceRequest) => Promise<boolean>;
  updateRequestStatus: (
    requestId: string,
    status: Extract<ResourceRequestStatus, "accepted" | "rejected">,
  ) => Promise<void>;
  loadMessages: (conversationId: string, beforeId?: string) => Promise<void>;
  sendMessage: (conversationId: string, body: string) => Promise<boolean>;
}>;

type ResourceSharingProviderProps = Readonly<{
  initialSnapshot: ResourceSharingSnapshot;
  children: ReactNode;
}>;

const ResourceSharingContext = createContext<ResourceSharingContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Resource sharing request failed.";
}

export function ResourceSharingProvider({
  initialSnapshot,
  children,
}: ResourceSharingProviderProps) {
  const [profile, setProfile] = useState(initialSnapshot.profile);
  const [people, setPeople] = useState<readonly ResourcePerson[]>(
    initialSnapshot.people,
  );
  const [requests, setRequests] = useState<readonly ResourceRequest[]>(
    initialSnapshot.requests,
  );
  const [conversations, setConversations] = useState<readonly ResourceConversation[]>(
    initialSnapshot.conversations,
  );
  const [messages, setMessages] = useState<readonly ResourceMessage[]>(
    initialSnapshot.messages,
  );
  const [hasOlderMessages, setHasOlderMessages] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(initialSnapshot.loadError ?? null);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await resourceSharingService.getSnapshot(
        initialSnapshot.currentUserId,
      );
      setProfile(snapshot.profile);
      setPeople(snapshot.people);
      setRequests(snapshot.requests);
      setConversations(snapshot.conversations);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [initialSnapshot.currentUserId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const saveProfile = useCallback(
    async (next: ResourceProfile) => {
      try {
        await resourceSharingService.saveProfile(next);
        await refresh();
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      }
    },
    [refresh],
  );

  const submitRequest = useCallback(
    async (request: NewResourceRequest) => {
      try {
        await resourceSharingService.submitRequest(request);
        await refresh();
        return true;
      } catch (cause) {
        setError(errorMessage(cause));
        return false;
      }
    },
    [refresh],
  );

  const updateRequestStatus = useCallback(
    async (
      requestId: string,
      status: Extract<ResourceRequestStatus, "accepted" | "rejected">,
    ) => {
      try {
        await resourceSharingService.decideRequest(requestId, status);
        await refresh();
      } catch (cause) {
        setError(errorMessage(cause));
      }
    },
    [refresh],
  );

  const loadMessages = useCallback(
    async (conversationId: string, beforeId?: string) => {
      try {
        const page = await resourceSharingService.getMessages(conversationId, beforeId);
        setMessages((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of page.items) byId.set(item.id, item);
          return [...byId.values()].sort(
            (a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id),
          );
        });
        setHasOlderMessages((current) => ({
          ...current,
          [conversationId]:
            beforeId || !(conversationId in current)
              ? page.hasMore
              : current[conversationId],
        }));
        setError(null);
      } catch (cause) {
        setError(errorMessage(cause));
      }
    },
    [],
  );

  const sendMessage = useCallback(async (conversationId: string, body: string) => {
    try {
      const sent = await resourceSharingService.sendMessage(conversationId, body);
      setMessages((current) => [...current, sent]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, lastActivityAt: sent.sentAt }
            : conversation,
        ),
      );
      setError(null);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      currentUserId: initialSnapshot.currentUserId,
      profile,
      people,
      requests,
      conversations,
      messages,
      hasOlderMessages,
      error,
      saveProfile,
      submitRequest,
      updateRequestStatus,
      loadMessages,
      sendMessage,
    }),
    [
      initialSnapshot.currentUserId,
      profile,
      people,
      requests,
      conversations,
      messages,
      hasOlderMessages,
      error,
      saveProfile,
      submitRequest,
      updateRequestStatus,
      loadMessages,
      sendMessage,
    ],
  );

  return (
    <ResourceSharingContext.Provider value={value}>
      {children}
    </ResourceSharingContext.Provider>
  );
}

export function useResourceSharing() {
  const context = useContext(ResourceSharingContext);
  if (!context) {
    throw new Error("useResourceSharing must be used inside ResourceSharingProvider.");
  }
  return context;
}
