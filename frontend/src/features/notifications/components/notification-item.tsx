"use client";

import Link from "next/link";

import { formatNotificationTime } from "@/features/notifications/lib/format-notification-time";
import type {
  AppNotification,
  NotificationType,
} from "@/features/notifications/types/notification";
import type { EntityId } from "@/types/common";

import styles from "./notification-item.module.css";

const notificationTypeLabels = {
  "event-started": "Event started",
  "event-finished": "Event finished",
  "club-membership-approved": "Membership approved",
  "campus-announcement": "Announcement",
  "campus-update": "Campus update",
} as const satisfies Record<NotificationType, string>;

type NotificationItemProps = Readonly<{
  notification: AppNotification;
  onMarkAsRead: (id: EntityId) => void;
  compact?: boolean;
}>;

export function NotificationItem({
  notification,
  onMarkAsRead,
  compact = false,
}: NotificationItemProps) {
  const content = (
    <>
      <div className={styles.meta}>
        <span className={styles.type} data-type={notification.type}>
          {notificationTypeLabels[notification.type]}
        </span>
        <time dateTime={notification.createdAt}>
          {formatNotificationTime(notification.createdAt)}
        </time>
      </div>
      <h3>{notification.title}</h3>
      <p>{notification.message}</p>
    </>
  );

  return (
    <article
      className={`${styles.item} ${notification.isRead ? styles.read : styles.unread} ${compact ? styles.compact : ""}`}
    >
      <span className={styles.unreadDot} aria-hidden="true" />
      <div className={styles.content}>
        {notification.href ? (
          <Link
            href={notification.href}
            onNavigate={() => onMarkAsRead(notification.id)}
          >
            {content}
          </Link>
        ) : (
          content
        )}
        {!notification.isRead ? (
          <button type="button" onClick={() => onMarkAsRead(notification.id)}>
            Mark as read
          </button>
        ) : null}
      </div>
    </article>
  );
}
