import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { ResourceSharingProvider } from "@/features/resources/context/resource-sharing-context";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";
import { resourceSharingService } from "@/services";

type ResourceSharingLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ResourceSharingLayout({
  children,
}: ResourceSharingLayoutProps) {
  const user = await requireServerSessionUser();
  const token = (await cookies()).get("unicircle_session")?.value;
  const snapshot = await resourceSharingService
    .getSnapshot(user.id, token)
    .catch(() => ({
      currentUserId: user.id,
      profile: {
        isDiscoverable: false,
        level: "",
        hall: "",
        availabilityNote: "",
        resourceCategories: [],
      },
      people: [],
      requests: [],
      conversations: [],
      messages: [],
      loadError:
        "Resource sharing is temporarily unavailable. Check that the backend is running, then refresh.",
    }));

  return (
    <ResourceSharingProvider initialSnapshot={snapshot}>
      {children}
    </ResourceSharingProvider>
  );
}
