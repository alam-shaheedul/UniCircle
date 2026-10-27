import type { Metadata } from "next";

import { ResourceHubPage } from "@/features/resources/components/resource-hub-page";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";

export const metadata: Metadata = {
  title: "Resource sharing",
  description: "Request and share everyday resources with the CUET community.",
};

export default async function ResourcesPage() {
  await requireServerSessionUser();
  return <ResourceHubPage />;
}
