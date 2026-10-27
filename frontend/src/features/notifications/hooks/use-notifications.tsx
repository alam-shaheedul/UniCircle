"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AppNotification } from "@/features/notifications/types/notification";
import { notificationService } from "@/services";
import type { EntityId } from "@/types/common";

type NotificationContextValue = Readonly<{
  notifications: readonly AppNotification[];
  unreadCount: number;
  markAsRead: (id: EntityId) => void;
  markAllAsRead: () => void;
}>;

type NotificationProviderProps = Readonly<{
  initialNotifications: readonly AppNotification[];
  children: ReactNode;
}>;

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  initialNotifications,
  children,
}: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([
    ...initialNotifications,
  ]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const markAsRead = useCallback((id: EntityId) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
    void notificationService.markAsRead(id);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
    void notificationService.markAllAsRead();
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead }),
    [markAllAsRead, markAsRead, notifications, unreadCount],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }

  return context;
}
