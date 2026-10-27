import { requireServerSessionUser } from "@/features/auth/lib/server-session";
import { MembershipRequestPage } from "@/features/clubs-events/components/membership-request-page";

type MembershipRequestsRouteProps = Readonly<{
  params: Promise<{ clubId: string }>;
}>;

export default async function MembershipRequestsRoute({
  params,
}: MembershipRequestsRouteProps) {
  await requireServerSessionUser();
  const { clubId } = await params;
  return <MembershipRequestPage clubId={clubId} />;
}
