import type {
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminCommunityReport,
  AdminDriver,
  AdminDriverInput,
  AdminRoute,
  AdminRouteInput,
  AdminSchedule,
  AdminScheduleInput,
  AdminSnapshot,
  PublishStatus,
  ReportStatus,
} from "@/features/admin/types/admin";

export interface AdminService {
  getSnapshot(token?: string): Promise<AdminSnapshot>;
  saveSchedule(input: AdminScheduleInput, id?: string): Promise<AdminSchedule>;
  deleteSchedule(id: string): Promise<void>;
  saveRoute(input: AdminRouteInput, id?: string): Promise<AdminRoute>;
  deleteRoute(id: string): Promise<void>;
  saveDriver(input: AdminDriverInput, id?: string): Promise<AdminDriver>;
  deleteDriver(id: string): Promise<void>;
  saveAnnouncement(
    input: AdminAnnouncementInput,
    id?: string,
  ): Promise<AdminAnnouncement>;
  deleteAnnouncement(id: string): Promise<void>;
  setAnnouncementStatus(
    announcement: AdminAnnouncement,
    status: PublishStatus,
  ): Promise<AdminAnnouncement>;
  setReportStatus(
    report: AdminCommunityReport,
    status: ReportStatus,
  ): Promise<AdminCommunityReport>;
}
