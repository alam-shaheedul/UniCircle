import type { Metadata } from "next";

import { AppShell } from "@/components/shared/app-shell";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";
import { NotificationList } from "@/features/notifications/components/notification-list";

export const metadata: Metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  await requireServerSessionUser();
  return (
    <AppShell>
      <header className="page-heading">
        <p className="eyebrow">Your activity</p>
        <h1>Notifications</h1>
        <p>Follow event activity and important campus announcements in one place.</p>
      </header>
      <NotificationList />
    </AppShell>
  );
}
