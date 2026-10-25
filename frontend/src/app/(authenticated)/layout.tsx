import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { AuthenticatedShell } from "@/features/auth/components/authenticated-shell";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";
import { clubEventService, notificationService } from "@/services";

type AuthenticatedLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const user = await requireServerSessionUser();
  const token = (await cookies()).get("unicircle_session")?.value;
  const [notifications, clubEventSnapshot] = await Promise.all([
    notificationService.list(token).catch(() => []),
    clubEventService.getSnapshot(token, user.role).catch(() => ({
      clubs: [],
      events: [],
      students: [],
      clubRequests: [],
      registrations: [],
      loadError:
        "Clubs and events could not be loaded. Check that the backend is running, then refresh this page.",
    })),
  ]);

  return (
    <AuthenticatedShell
      initialUser={user}
      initialClubEventSnapshot={clubEventSnapshot}
      initialNotifications={notifications}
    >
      {children}
    </AuthenticatedShell>
  );
}
