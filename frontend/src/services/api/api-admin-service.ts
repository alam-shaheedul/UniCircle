import type {
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminCommunityReport,
  AdminDriver,
  AdminDriverInput,
  AdminRouteInput,
  AdminSchedule,
  AdminScheduleInput,
  AdminSnapshot,
  PublishStatus,
  ReportStatus,
} from "@/features/admin/types/admin";
import type { AdminService } from "@/services/contracts/admin-service";
import { ServiceError } from "@/services/errors/service-error";

type TransportAdminRecord = {
  routes: { id: string; name: string; outboundStops: string[] }[];
  buses: NonNullable<AdminSnapshot["buses"]>;
  drivers: (AdminDriver & {
    driverClass: "heavy" | "light";
    assignedBusId: string | null;
    assignedBusName: string | null;
    sourceRow: number | null;
  })[];
  schedules: (AdminSchedule & {
    busId: string;
    direction: NonNullable<AdminSchedule["direction"]>;
    origin: string;
    destination: string;
    recurrenceUntil: string | null;
  })[];
};

type NewsAdminRecord = {
  id: string;
  type: AdminAnnouncement["type"];
  title: string;
  summary: string;
  content: string[];
  audience: string;
  status: PublishStatus;
  updatedAt: string;
};

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((item) => item.startsWith("unicircle_csrf="));
  return value ? decodeURIComponent(value.slice("unicircle_csrf=".length)) : "";
}

async function data<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/transport/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach Admin transport services.", "network", {
      cause,
    });
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data) {
    throw new ServiceError(result?.error?.message ?? "Admin transport request failed.");
  }
  return result.data as T;
}

async function forumData<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/forum/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach forum moderation services.", "network", {
      cause,
    });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result)) {
    throw new ServiceError(
      result?.error?.message ?? "Forum moderation request failed.",
    );
  }
  return result.data as T;
}

async function newsData<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const url = token
    ? new URL(`/api/v1/${path}`, process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000")
    : `/api/news/${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(!token && method !== "GET" ? { "X-CSRF-Token": csrfToken() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: token ? undefined : "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    throw new ServiceError("Cannot reach campus publishing services.", "network", {
      cause,
    });
  }
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || !("data" in result)) {
    throw new ServiceError(
      result?.error?.message ?? "Campus publishing request failed.",
    );
  }
  return result.data as T;
}

function mapAnnouncement(record: NewsAdminRecord): AdminAnnouncement {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    summary: record.summary,
    content: record.content.join("\n\n"),
    audience: record.audience,
    status: record.status,
    updatedAt: record.updatedAt,
  };
}

function announcementPayload(input: AdminAnnouncementInput) {
  return {
    type: input.type,
    title: input.title,
    summary: input.summary,
    content: input.content
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    audience: input.audience,
    status: input.status,
  };
}

function mapTransport(
  record: TransportAdminRecord,
): Pick<AdminSnapshot, "routes" | "buses" | "drivers" | "schedules"> {
  return {
    routes: record.routes.map((item) => ({
      id: item.id,
      name: item.name,
      stops: item.outboundStops,
    })),
    buses: record.buses,
    drivers: record.drivers.map((item) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      assignedBusId: item.assignedBusId ?? undefined,
      assignedBusName: item.assignedBusName ?? undefined,
      driverClass: item.driverClass,
      licenseNumber: item.sourceRow ? `PDF row ${item.sourceRow}` : undefined,
    })),
    schedules: record.schedules.map((item) => ({
      ...item,
      recurrenceUntil: item.recurrenceUntil ?? undefined,
    })),
  };
}

function schedulePayload(input: AdminScheduleInput) {
  const direction =
    input.direction ??
    (input.routeId === "rastar-matha-loop"
      ? "round-trip"
      : input.title.toLowerCase().includes("arrival") ||
          input.title.toLowerCase().includes("return")
        ? "to-campus"
        : "from-campus");
  return {
    title: input.title,
    service_date: input.serviceDate,
    start_time: input.startTime,
    end_time: input.endTime,
    direction,
    origin:
      input.origin ?? (direction === "to-campus" ? "Bottoli Rail Station" : "CUET"),
    destination:
      input.destination ??
      (direction === "to-campus"
        ? "CUET"
        : direction === "round-trip"
          ? "Rastar Matha and return"
          : "Bottoli Rail Station"),
    route_id: input.routeId,
    bus_id:
      input.busId ??
      input.busName
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    driver_id: input.driverId,
    recurrence: input.recurrence,
    recurrence_until: input.recurrenceUntil || null,
    is_active: true,
  };
}

export class ApiAdminService implements AdminService {
  async getSnapshot(token?: string): Promise<AdminSnapshot> {
    const [transportRecord, reports, announcementRecords] = await Promise.all([
      data<TransportAdminRecord>("admin/transport", "GET", undefined, token),
      forumData<AdminCommunityReport[]>("admin/forum/reports", "GET", undefined, token),
      newsData<NewsAdminRecord[]>("admin/news", "GET", undefined, token),
    ]);
    return {
      ...mapTransport(transportRecord),
      announcements: announcementRecords.map(mapAnnouncement),
      reports,
    };
  }

  async saveSchedule(input: AdminScheduleInput, id?: string) {
    return data<AdminSchedule>(
      `admin/transport/schedules${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      schedulePayload(input),
    );
  }
  async deleteSchedule(id: string) {
    await data(`admin/transport/schedules/${id}`, "DELETE");
  }
  async saveRoute(input: AdminRouteInput, id?: string) {
    const stops = input.stops
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const record = await data<{ id: string; name: string; outboundStops: string[] }>(
      `admin/transport/routes${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      {
        name: input.name,
        outbound_stops: stops,
        return_stops: [...stops].reverse(),
        is_active: true,
      },
    );
    return { id: record.id, name: record.name, stops: record.outboundStops };
  }
  async deleteRoute(id: string) {
    await data(`admin/transport/routes/${id}`, "DELETE");
  }
  async saveDriver(input: AdminDriverInput, id?: string) {
    return data<AdminDriver>(
      `admin/transport/drivers${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      {
        name: input.name,
        phone: input.phone,
        driver_class: input.driverClass ?? "heavy",
        assigned_bus_id: input.assignedBusId ?? null,
        is_active: true,
      },
    );
  }
  async deleteDriver(id: string) {
    await data(`admin/transport/drivers/${id}`, "DELETE");
  }
  async saveAnnouncement(
    input: AdminAnnouncementInput,
    id?: string,
  ): Promise<AdminAnnouncement> {
    const record = await newsData<NewsAdminRecord>(
      `admin/news${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      announcementPayload(input),
    );
    return mapAnnouncement(record);
  }
  async deleteAnnouncement(id: string): Promise<void> {
    await newsData(`admin/news/${id}`, "DELETE");
  }
  async setAnnouncementStatus(
    item: AdminAnnouncement,
    status: PublishStatus,
  ): Promise<AdminAnnouncement> {
    const record = await newsData<NewsAdminRecord>(
      `admin/news/${item.id}/status`,
      "PUT",
      { status },
    );
    return mapAnnouncement(record);
  }
  setReportStatus(
    item: AdminCommunityReport,
    status: ReportStatus,
  ): Promise<AdminCommunityReport> {
    if (status === "open") {
      throw new ServiceError("A reviewed report cannot be reopened.");
    }
    return forumData<AdminCommunityReport>(`admin/forum/reports/${item.id}`, "PUT", {
      decision: status,
    });
  }
}
