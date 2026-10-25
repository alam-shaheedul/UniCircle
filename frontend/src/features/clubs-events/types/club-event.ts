import type { EntityId } from "@/types/common";

export type EventStatus = "ongoing" | "upcoming" | "finished";

export type AttendanceStatus = "none" | "interested" | "going";

export type ClubRequestStatus = "pending" | "approved" | "rejected";

export type ClubMember = Readonly<{
  id: EntityId;
  name: string;
  role: string;
  department: string;
}>;

export type RegisteredStudent = Readonly<{
  userId: EntityId;
  name: string;
  email: string;
  studentId: string;
  department: string;
}>;

export type CampusClub = Readonly<{
  id: EntityId;
  shortName: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  memberCount: number;
  accent: string;
  activities: readonly string[];
  leaders: readonly ClubMember[];
  adminUserIds: readonly EntityId[];
  adminStudents?: readonly RegisteredStudent[];
  isMember?: boolean;
  membershipRequestStatus?: "pending" | "approved";
  pendingMembershipRequestCount?: number;
  membershipRecruitment?: Readonly<{
    open: boolean;
    fee: 200;
    bkashNumber?: string;
    nagadNumber?: string;
  }>;
}>;

export type MembershipSettingsInput = Readonly<{
  open: boolean;
  bkashNumber: string;
  nagadNumber: string;
}>;

export type MembershipRequestInput = Readonly<{
  applicantName: string;
  email: string;
  studentId: string;
  departmentName: string;
  phone: string;
  motivation: string;
  paymentMethod: "bkash" | "nagad";
  transactionId: string;
}>;

export type MembershipRequest = MembershipRequestInput &
  Readonly<{
    id: EntityId;
    clubId: EntityId;
    userId: EntityId;
    fee: 200;
    status: "pending" | "approved";
    submittedAt: string;
    reviewedAt?: string;
  }>;

export type EventRegistrationSettings = Readonly<{
  enabled: boolean;
  isPaid: boolean;
  feeAmount?: number;
  bkashNumber?: string;
}>;

export type CampusEvent = Readonly<{
  id: EntityId;
  clubId: EntityId;
  title: string;
  category: string;
  summary: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  attendeeCount: number;
  registeredCount: number;
  registration: EventRegistrationSettings;
  myInterest?: AttendanceStatus;
  myRegistration?: Readonly<{ id: EntityId; paymentStatus: string }> | null;
}>;

export type EventRegistration = Readonly<{
  id: EntityId;
  eventId: EntityId;
  userId: EntityId;
  name: string;
  email: string;
  studentId: string;
  department: string;
  bkashTransactionId?: string;
  registeredAt: string;
}>;

export type ClubCreationRequest = Readonly<{
  id: EntityId;
  requestedByUserId: EntityId;
  requestedByName: string;
  requestedByStudentId: string;
  name: string;
  shortName: string;
  category: string;
  tagline: string;
  description: string;
  purpose: string;
  activities: readonly string[];
  status: ClubRequestStatus;
  submittedAt: string;
  reviewedAt?: string;
}>;

export type ClubEventSnapshot = Readonly<{
  clubs: readonly CampusClub[];
  events: readonly CampusEvent[];
  students: readonly RegisteredStudent[];
  clubRequests: readonly ClubCreationRequest[];
  registrations: readonly EventRegistration[];
  loadError?: string;
}>;

export type ClubProfileInput = Pick<
  CampusClub,
  "name" | "shortName" | "category" | "tagline" | "description"
> &
  Readonly<{ activities: string }>;

export type ClubCreationRequestInput = ClubProfileInput & Readonly<{ purpose: string }>;

export type CampusEventInput = Omit<
  CampusEvent,
  "id" | "clubId" | "attendeeCount" | "registeredCount"
>;

export type EventRegistrationInput = Omit<
  EventRegistration,
  "id" | "eventId" | "userId" | "registeredAt"
>;
