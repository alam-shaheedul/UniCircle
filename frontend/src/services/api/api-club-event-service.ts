import type {
  AttendanceStatus,
  CampusClub,
  CampusEvent,
  CampusEventInput,
  ClubCreationRequest,
  ClubCreationRequestInput,
  ClubEventSnapshot,
  ClubProfileInput,
  ClubRequestStatus,
  EventRegistration,
  EventRegistrationInput,
  MembershipRequest,
  MembershipRequestInput,
  MembershipSettingsInput,
  RegisteredStudent,
} from "@/features/clubs-events/types/club-event";
import type { ClubEventService } from "@/services/contracts/club-event-service";
import { ServiceError } from "@/services/errors/service-error";

type ClubRecord = {
  id: string;
  shortName: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  memberCount: number;
  activities: string[];
  adminUserIds: string[];
  adminUsers: { userId: string; name: string; studentId: string; department: string }[];
  isMember: boolean;
  membershipRequestStatus: "pending" | "approved" | null;
  pendingMembershipRequestCount: number;
  membershipRecruitment: {
    open: boolean;
    fee: 200;
    bkashNumber: string | null;
    nagadNumber: string | null;
  };
};

type MembershipRequestRecord = {
  id: string;
  clubId: string;
  userId: string;
  applicantName: string;
  email: string;
  studentId: string;
  departmentName: string;
  phone: string;
  motivation: string;
  paymentMethod: "bkash" | "nagad";
  transactionId: string;
  fee: 200;
  status: "pending" | "approved";
  submittedAt: string;
  reviewedAt: string | null;
};

type EventRecord = {
  id: string;
  clubId: string;
  title: string;
  category: string;
  summary: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: CampusEvent["status"];
  goingCount: number;
  registeredCount: number;
  registrationEnabled: boolean;
  isPaid: boolean;
  fee: number;
  bkashNumber: string | null;
  myInterest: CampusEvent["myInterest"];
  myRegistration: CampusEvent["myRegistration"];
};

type RequestRecord = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterStudentId: string;
  name: string;
  shortName: string;
  category: string;
  tagline: string;
  description: string;
  purpose: string;
  activities: string[];
  status: ClubRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  approvedClubId: string | null;
};

const accentByClub: Record<string, string> = {
  "cuet-computer-club": "#0d6a45",
  "andromeda-space-robotics": "#325c91",
  "robo-mechatronics-association": "#9a6710",
  joyoddhoni: "#8a3d55",
  "cuet-debating-society": "#5b4789",
};

function mapClub(record: ClubRecord): CampusClub {
  const admins: RegisteredStudent[] = record.adminUsers.map((item) => ({
    userId: item.userId,
    name: item.name,
    studentId: item.studentId,
    department: item.department,
    email: "",
  }));
  return {
    id: record.id,
    shortName: record.shortName,
    name: record.name,
    category: record.category,
    tagline: record.tagline,
    description: record.description,
    memberCount: record.memberCount,
    accent: accentByClub[record.id] ?? "#0d6a45",
    activities: record.activities,
    adminUserIds: record.adminUserIds,
    adminStudents: admins,
    leaders: admins.map((item) => ({
      id: item.userId,
      name: item.name,
      role: "Club admin",
      department: item.department,
    })),
    isMember: record.isMember,
    membershipRequestStatus: record.membershipRequestStatus ?? undefined,
    pendingMembershipRequestCount: record.pendingMembershipRequestCount,
    membershipRecruitment: {
      open: record.membershipRecruitment.open,
      fee: record.membershipRecruitment.fee,
      bkashNumber: record.membershipRecruitment.bkashNumber ?? undefined,
      nagadNumber: record.membershipRecruitment.nagadNumber ?? undefined,
    },
  };
}

function mapMembershipRequest(record: MembershipRequestRecord): MembershipRequest {
  return {
    id: record.id,
    clubId: record.clubId,
    userId: record.userId,
    applicantName: record.applicantName,
    email: record.email,
    studentId: record.studentId,
    departmentName: record.departmentName,
    phone: record.phone,
    motivation: record.motivation,
    paymentMethod: record.paymentMethod,
    transactionId: record.transactionId,
    fee: record.fee,
    status: record.status,
    submittedAt: record.submittedAt,
    reviewedAt: record.reviewedAt ?? undefined,
  };
}

function mapEvent(record: EventRecord): CampusEvent {
  return {
    id: record.id,
    clubId: record.clubId,
    title: record.title,
    category: record.category,
    summary: record.summary,
    location: record.location,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    status: record.status,
    attendeeCount: record.goingCount,
    registeredCount: record.registeredCount,
    registration: {
      enabled: record.registrationEnabled,
      isPaid: record.isPaid,
      feeAmount: record.fee,
      bkashNumber: record.bkashNumber ?? undefined,
    },
    myInterest: record.myInterest,
    myRegistration: record.myRegistration,
  };
}

function mapRequest(record: RequestRecord): ClubCreationRequest {
  return {
    id: record.id,
    requestedByUserId: record.requesterId,
    requestedByName: record.requesterName,
    requestedByStudentId: record.requesterStudentId,
    name: record.name,
    shortName: record.shortName,
    category: record.category,
    tagline: record.tagline,
    description: record.description,
    purpose: record.purpose,
    activities: record.activities,
    status: record.status,
    submittedAt: record.createdAt,
    reviewedAt: record.reviewedAt ?? undefined,
  };
}

function splitActivities(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("unicircle_csrf="));
  return value ? decodeURIComponent(value.slice("unicircle_csrf=".length)) : "";
}

async function requestData<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const bodylessJsonMutation = method !== "GET" && method !== "DELETE";
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/club-events/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined || bodylessJsonMutation
          ? { "Content-Type": "application/json" }
          : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach the club and event service.", "network", {
      cause,
    });
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result)) {
    throw new ServiceError(
      result?.error?.message ?? "Club and event request failed.",
      response.status === 401
        ? "unauthorized"
        : response.status === 409
          ? "conflict"
          : "unknown",
    );
  }
  return result.data as T;
}

export class ApiClubEventService implements ClubEventService {
  async getSnapshot(token?: string, role?: string): Promise<ClubEventSnapshot> {
    const requestPath =
      role === "admin" ? "admin/club-requests?size=100" : "clubs/requests/mine";
    const [clubRecords, eventRecords, requestRecords] = await Promise.all([
      requestData<ClubRecord[]>("clubs", "GET", undefined, token),
      requestData<EventRecord[]>("events?limit=100", "GET", undefined, token),
      role === "admin" || role === "student"
        ? requestData<RequestRecord[] | { items: RequestRecord[] }>(
            requestPath,
            "GET",
            undefined,
            token,
          )
        : Promise.resolve([]),
    ]);
    const clubs = clubRecords.map(mapClub);
    const students = new Map<string, RegisteredStudent>();
    for (const club of clubs) {
      for (const student of club.adminStudents ?? [])
        students.set(student.userId, student);
    }
    return {
      clubs,
      events: eventRecords.map(mapEvent),
      students: [...students.values()],
      clubRequests: (Array.isArray(requestRecords)
        ? requestRecords
        : requestRecords.items
      ).map(mapRequest),
      registrations: [],
    };
  }

  async listClubs(): Promise<readonly CampusClub[]> {
    return (await requestData<ClubRecord[]>("clubs")).map(mapClub);
  }

  async listEvents(): Promise<readonly CampusEvent[]> {
    return (await requestData<EventRecord[]>("events?limit=100")).map(mapEvent);
  }

  async submitClubRequest(
    input: ClubCreationRequestInput,
  ): Promise<ClubCreationRequest> {
    const record = await requestData<RequestRecord>("clubs/requests", "POST", {
      name: input.name,
      short_name: input.shortName,
      category: input.category,
      tagline: input.tagline,
      description: input.description,
      purpose: input.purpose,
      activities: splitActivities(input.activities),
    });
    return mapRequest(record);
  }

  async reviewClubRequest(
    request: ClubCreationRequest,
    status: Exclude<ClubRequestStatus, "pending">,
  ): Promise<{ request: ClubCreationRequest; club?: CampusClub }> {
    const record = await requestData<RequestRecord>(
      `admin/club-requests/${request.id}/review`,
      "POST",
      { decision: status },
    );
    const club = record.approvedClubId
      ? mapClub(await requestData<ClubRecord>(`clubs/${record.approvedClubId}`))
      : undefined;
    return { request: mapRequest(record), club };
  }

  async saveClub(input: ClubProfileInput, current: CampusClub): Promise<CampusClub> {
    return mapClub(
      await requestData<ClubRecord>(`clubs/${current.id}`, "PUT", {
        name: input.name,
        short_name: input.shortName,
        category: input.category,
        tagline: input.tagline,
        description: input.description,
        activities: splitActivities(input.activities),
      }),
    );
  }

  async setClubAdmins(
    club: CampusClub,
    adminUserIds: readonly string[],
  ): Promise<CampusClub> {
    const added = adminUserIds.find((id) => !club.adminUserIds.includes(id));
    if (added)
      return mapClub(
        await requestData<ClubRecord>(`clubs/${club.id}/admins`, "POST", {
          student_id: added,
        }),
      );
    const removed = club.adminUserIds.find((id) => !adminUserIds.includes(id));
    if (removed)
      return mapClub(
        await requestData<ClubRecord>(`clubs/${club.id}/admins/${removed}`, "DELETE"),
      );
    return club;
  }

  async updateMembershipSettings(
    clubId: string,
    input: MembershipSettingsInput,
  ): Promise<CampusClub> {
    return mapClub(
      await requestData<ClubRecord>(`clubs/${clubId}/membership-settings`, "PUT", {
        recruitment_open: input.open,
        bkash_number: input.bkashNumber || null,
        nagad_number: input.nagadNumber || null,
      }),
    );
  }

  async submitMembershipRequest(
    clubId: string,
    input: MembershipRequestInput,
  ): Promise<MembershipRequest> {
    const record = await requestData<MembershipRequestRecord>(
      `clubs/${clubId}/membership-requests`,
      "POST",
      {
        applicant_name: input.applicantName,
        email: input.email,
        student_id: input.studentId,
        department_name: input.departmentName,
        phone: input.phone,
        motivation: input.motivation,
        payment_method: input.paymentMethod,
        transaction_id: input.transactionId,
      },
    );
    return mapMembershipRequest(record);
  }

  async listMembershipRequests(clubId: string) {
    const records = await requestData<MembershipRequestRecord[]>(
      `clubs/${clubId}/membership-requests`,
    );
    return records.map(mapMembershipRequest);
  }

  async approveMembershipRequest(clubId: string, requestId: string) {
    const result = await requestData<{
      request: MembershipRequestRecord;
      club: ClubRecord;
    }>(`clubs/${clubId}/membership-requests/${requestId}/approve`, "POST");
    return {
      request: mapMembershipRequest(result.request),
      club: mapClub(result.club),
    };
  }

  async removeMembershipRequest(clubId: string, requestId: string) {
    await requestData<void>(
      `clubs/${clubId}/membership-requests/${requestId}`,
      "DELETE",
    );
  }

  async saveEvent(
    input: CampusEventInput,
    clubId: string,
    current?: CampusEvent,
  ): Promise<CampusEvent> {
    const record = await requestData<EventRecord>(
      current ? `events/${current.id}` : `clubs/${clubId}/events`,
      current ? "PUT" : "POST",
      {
        title: input.title,
        category: input.category,
        summary: input.summary,
        location: input.location,
        starts_at: new Date(input.startsAt).toISOString(),
        ends_at: new Date(input.endsAt).toISOString(),
        registration_enabled: input.registration.enabled,
        is_paid: input.registration.enabled && input.registration.isPaid,
        fee:
          input.registration.enabled && input.registration.isPaid
            ? (input.registration.feeAmount ?? 0)
            : 0,
        bkash_number:
          input.registration.enabled && input.registration.isPaid
            ? (input.registration.bkashNumber ?? null)
            : null,
      },
    );
    return mapEvent(record);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await requestData<void>(`events/${eventId}`, "DELETE");
  }

  async setInterest(eventId: string, status: AttendanceStatus): Promise<CampusEvent> {
    return mapEvent(
      await requestData<EventRecord>(`events/${eventId}/interest`, "PUT", { status }),
    );
  }

  async registerForEvent(
    eventId: string,
    userId: string,
    input: EventRegistrationInput,
  ): Promise<EventRegistration> {
    const result = await requestData<{ id: string }>(
      `events/${eventId}/registrations`,
      "POST",
      {
        participant_name: input.name,
        email: input.email,
        student_id: input.studentId,
        department_name: input.department,
        bkash_trx_id: input.bkashTransactionId || null,
      },
    );
    return {
      id: result.id,
      eventId,
      userId,
      ...input,
      registeredAt: new Date().toISOString(),
    };
  }
}
