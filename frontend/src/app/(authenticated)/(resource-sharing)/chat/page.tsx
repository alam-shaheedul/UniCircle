import type { Metadata } from "next";

import { ResourceChatPage } from "@/features/chat/components/resource-chat-page";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";

export const metadata: Metadata = {
  title: "Resource chat",
  description: "Coordinate accepted resource exchanges with other CUET students.",
};

export default async function ChatPage() {
  await requireServerSessionUser();
  return <ResourceChatPage />;
}
