import type { AppNotification } from "@/features/notifications/types/notification";
import type { EntityId } from "@/types/common";

export interface NotificationService {
  list(token?: string): Promise<readonly AppNotification[]>;
  markAsRead(id: EntityId): Promise<void>;
  markAllAsRead(): Promise<void>;
}
