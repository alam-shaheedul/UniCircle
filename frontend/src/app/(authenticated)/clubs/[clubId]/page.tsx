import { ClubDetailRoute } from "@/features/clubs-events/components/club-detail-page";
import { requireServerSessionUser } from "@/features/auth/lib/server-session";

type ClubDetailsRouteProps = Readonly<{
  params: Promise<{ clubId: string }>;
}>;

export default async function ClubDetailsRoute({ params }: ClubDetailsRouteProps) {
  await requireServerSessionUser();
  const { clubId } = await params;
  return <ClubDetailRoute clubId={clubId} />;
}
