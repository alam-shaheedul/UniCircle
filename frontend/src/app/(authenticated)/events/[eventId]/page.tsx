import { EventDetailRoute } from "@/features/clubs-events/components/event-detail-route";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";

export default async function EventDetailPage({
  params,
}: Readonly<{ params: Promise<{ eventId: string }> }>) {
  await requireServerSessionUser();
  const { eventId } = await params;
  return <EventDetailRoute eventId={eventId} />;
}
