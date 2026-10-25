"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LoadingState } from "@/components/ui/feedback/loading-state";
import { routes } from "@/config/routes";
import { UnauthorizedAdminState } from "@/features/admin/components/unauthorized-admin-state";
import { AuthenticatedUserProvider } from "@/features/auth/context/authenticated-user-context";
import type { SessionUser } from "@/features/auth/types/session-user";
import { ClubEventProvider } from "@/features/clubs-events/context/club-event-context";
import type { ClubEventSnapshot } from "@/features/clubs-events/types/club-event";
import { NotificationProvider } from "@/features/notifications/hooks/use-notifications";
import type { AppNotification } from "@/features/notifications/types/notification";
import { Navbar } from "@/features/shell/components/navbar";
import { sessionService } from "@/services";

type AuthenticatedShellProps = Readonly<{
  children: ReactNode;
  initialUser: SessionUser;
  initialNotifications: readonly AppNotification[];
  initialClubEventSnapshot: ClubEventSnapshot;
}>;

export function AuthenticatedShell({
  children,
  initialUser,
  initialNotifications,
  initialClubEventSnapshot,
}: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void sessionService
      .getCurrentUser()
      .then((currentUser) => {
        if (!isCurrent) return;
        setUser(currentUser);
        setSessionError(false);
        if (!currentUser) router.replace(routes.auth.login);
      })
      .catch(() => {
        if (isCurrent) setSessionError(true);
      });

    return () => {
      isCurrent = false;
    };
  }, [pathname, router]);

  const isAdminRoute =
    pathname === routes.admin || pathname.startsWith(`${routes.admin}/`);
  const isUnauthorizedAdminRoute =
    user !== null && isAdminRoute && user.role !== "admin";

  if (sessionError) {
    return (
      <main className="app-shell" id="main-content" role="alert">
        Session check failed. Please refresh the page and try again.
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell" id="main-content">
        <LoadingState label="Checking your UniCircle session" />
      </main>
    );
  }

  if (isUnauthorizedAdminRoute) {
    return (
      <AuthenticatedUserProvider initialUser={user}>
        <ClubEventProvider initialSnapshot={initialClubEventSnapshot}>
          <NotificationProvider initialNotifications={initialNotifications}>
            <Navbar />
            <UnauthorizedAdminState />
          </NotificationProvider>
        </ClubEventProvider>
      </AuthenticatedUserProvider>
    );
  }

  return (
    <AuthenticatedUserProvider initialUser={user}>
      <ClubEventProvider initialSnapshot={initialClubEventSnapshot}>
        <NotificationProvider initialNotifications={initialNotifications}>
          <Navbar />
          {children}
        </NotificationProvider>
      </ClubEventProvider>
    </AuthenticatedUserProvider>
  );
}
