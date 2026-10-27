import type { EntityId } from "@/types/common";

export type NotificationType =
  | "event-started"
  | "event-finished"
  | "club-membership-approved"
  | "campus-announcement"
  | "campus-update";

export type AppNotification = Readonly<{
  id: EntityId;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  href?: string;
}>;
