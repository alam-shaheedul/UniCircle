import type { CampusNewsType } from "@/features/news/types/campus-news";

export type AdminSectionId =
  "overview" | "transport" | "announcements" | "club-requests" | "reports";
export type ScheduleRecurrence = "once" | "daily" | "weekly" | "monthly";
export type PublishStatus = "draft" | "published";
export type ReportStatus = "open" | "resolved" | "post-removed";

export type AdminRoute = Readonly<{
  id: string;
  name: string;
  stops: readonly string[];
}>;

export type AdminDriver = Readonly<{
  id: string;
  name: string;
  phone: string;
  licenseNumber?: string;
  assignedBusId?: string;
  assignedBusName?: string;
  driverClass?: "heavy" | "light";
}>;

export type AdminBus = Readonly<{
  id: string;
  name: string;
  type: "student" | "teacher" | "staff";
  registration: string;
}>;

export type AdminSchedule = Readonly<{
  id: string;
  title: string;
  serviceDate: string;
  startTime: string;
  endTime: string;
  routeId: string;
  driverId: string;
  busName: string;
  busId?: string;
  direction?: "to-campus" | "from-campus" | "round-trip";
  origin?: string;
  destination?: string;
  recurrenceUntil?: string;
  recurrence: ScheduleRecurrence;
}>;

export type AdminAnnouncement = Readonly<{
  id: string;
  type: CampusNewsType;
  title: string;
  summary: string;
  content: string;
  audience: string;
  status: PublishStatus;
  updatedAt: string;
}>;

export type AdminCommunityReport = Readonly<{
  id: string;
  postId: string;
  authorName: string;
  reportedBy: string;
  reason: string;
  postBody: string;
  reportedAt: string;
  status: ReportStatus;
}>;

export type AdminSnapshot = Readonly<{
  routes: readonly AdminRoute[];
  buses?: readonly AdminBus[];
  drivers: readonly AdminDriver[];
  schedules: readonly AdminSchedule[];
  announcements: readonly AdminAnnouncement[];
  reports: readonly AdminCommunityReport[];
}>;

export type AdminRouteInput = Omit<AdminRoute, "id" | "stops"> & {
  stops: string;
};

export type AdminDriverInput = Omit<AdminDriver, "id">;

export type AdminScheduleInput = Omit<AdminSchedule, "id">;

export type AdminAnnouncementInput = Omit<AdminAnnouncement, "id" | "updatedAt">;
