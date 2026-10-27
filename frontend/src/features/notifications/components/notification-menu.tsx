"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { routes } from "@/config/routes";
import { NotificationItem } from "@/features/notifications/components/notification-item";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";

import styles from "./notification-menu.module.css";

export function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        className={styles.trigger}
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge}>{Math.min(unreadCount, 9)}</span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          className={styles.panel}
          id={panelId}
          aria-label="Recent notifications"
        >
          <div className={styles.heading}>
            <div>
              <p>Notifications</p>
              <span>{unreadCount} unread</span>
            </div>
            <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </div>

          <div className={styles.items}>
            {notifications.length === 0 ? (
              <p className={styles.empty}>You have no notifications.</p>
            ) : (
              notifications
                .slice(0, 4)
                .map((notification) => (
                  <NotificationItem
                    compact
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                  />
                ))
            )}
          </div>

          <Link
            className={styles.viewAll}
            href={routes.notifications}
            onNavigate={() => setIsOpen(false)}
          >
            View all notifications
          </Link>
        </section>
      ) : null}
    </div>
  );
}
