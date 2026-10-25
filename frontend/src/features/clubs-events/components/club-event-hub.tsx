"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/ui/feedback/empty-state";
import { routes } from "@/config/routes";
import { useAuthenticatedUser } from "@/features/auth/context/authenticated-user-context";
import { ClubCreationRequestForm } from "@/features/clubs-events/components/club-creation-request-form";
import { useClubEvents } from "@/features/clubs-events/context/club-event-context";
import type {
  AttendanceStatus,
  CampusClub,
  CampusEvent,
  EventStatus,
} from "@/features/clubs-events/types/club-event";

import styles from "./club-event-hub.module.css";
import { EventCard } from "./event-card";
import { HubNavigation } from "./hub-navigation";

type HubView = "clubs" | "events";
type EventFilter = "all" | EventStatus;

type ClubEventHubProps = Readonly<{
  view: HubView;
}>;

const eventFilters = [
  { id: "all", label: "All events" },
  { id: "ongoing", label: "Ongoing" },
  { id: "upcoming", label: "Upcoming" },
  { id: "finished", label: "Finished" },
] as const satisfies readonly { id: EventFilter; label: string }[];

export function ClubEventHub({ view }: ClubEventHubProps) {
  const { user } = useAuthenticatedUser();
  const { snapshot, submitClubRequest, setInterest } = useClubEvents();
  const { clubs, events } = snapshot;
  const [actionError, setActionError] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [isRequestingClub, setIsRequestingClub] = useState(false);

  const clubNames = useMemo(
    () => new Map(clubs.map((club) => [club.id, club.name])),
    [clubs],
  );

  const filteredEvents = useMemo(
    () =>
      eventFilter === "all"
        ? events
        : events.filter((event) => event.status === eventFilter),
    [eventFilter, events],
  );

  const eventCounts = useMemo(
    () => ({
      all: events.length,
      ongoing: events.filter((event) => event.status === "ongoing").length,
      upcoming: events.filter((event) => event.status === "upcoming").length,
      finished: events.filter((event) => event.status === "finished").length,
    }),
    [events],
  );

  async function changeAttendance(eventId: string, status: AttendanceStatus) {
    const current = events.find((item) => item.id === eventId)?.myInterest ?? "none";
    setActionError("");
    try {
      await setInterest(eventId, current === status ? "none" : status);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Attendance could not be updated.",
      );
    }
  }

  return (
    <AppShell className={styles.pageShell}>
      <section className={styles.hero} aria-labelledby="club-event-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>CUET student life</p>
          <h1 id="club-event-title">
            Find your circle. <span>Make campus count.</span>
          </h1>
          <p>
            Meet the student communities building, debating, creating, and competing
            across CUET—then keep every event you care about within reach.
          </p>
          <div className={styles.previewNotice}>
            <span aria-hidden="true">i</span>
            Live club and event information
          </div>
        </div>

        <div className={styles.heroStats} aria-label="Club and event summary">
          <div>
            <strong>{clubs.length}</strong>
            <span>clubs to explore</span>
          </div>
          <div>
            <strong>{eventCounts.ongoing}</strong>
            <span>happening now</span>
          </div>
          <div>
            <strong>{eventCounts.upcoming}</strong>
            <span>coming up</span>
          </div>
        </div>
      </section>

      <HubNavigation activeView={view} />

      {snapshot.loadError ? (
        <p className={styles.formError} role="alert">
          {snapshot.loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className={styles.formError} role="alert">
          {actionError}
        </p>
      ) : null}

      {view === "clubs" ? (
        <ClubDirectory
          clubs={clubs}
          currentUserId={user.id}
          isStudent={user.role === "student"}
          onCreateClub={() => setIsRequestingClub(true)}
          requests={snapshot.clubRequests}
        />
      ) : (
        <CampusEventDirectory
          clubNames={clubNames}
          eventCounts={eventCounts}
          eventFilter={eventFilter}
          events={filteredEvents}
          onAttendanceChange={changeAttendance}
          onFilterChange={setEventFilter}
        />
      )}

      {isRequestingClub ? (
        <ClubCreationRequestForm
          onClose={() => setIsRequestingClub(false)}
          onSubmit={submitClubRequest}
        />
      ) : null}
    </AppShell>
  );
}

type ClubDirectoryProps = Readonly<{
  clubs: readonly CampusClub[];
  currentUserId: string;
  isStudent: boolean;
  onCreateClub: () => void;
  requests: ReturnType<typeof useClubEvents>["snapshot"]["clubRequests"];
}>;

function ClubDirectory({
  clubs,
  currentUserId,
  isStudent,
  onCreateClub,
  requests,
}: ClubDirectoryProps) {
  const ownRequests = requests.filter(
    (request) => request.requestedByUserId === currentUserId,
  );

  return (
    <section className={styles.clubDirectory} aria-labelledby="club-directory-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Club directory</p>
          <h2 id="club-directory-title">Choose a campus community</h2>
        </div>
        <div className={styles.clubCreationActions}>
          <p>
            Open any club to see its purpose, leadership, regular activities, and
            upcoming event calendar.
          </p>
          {isStudent ? (
            <button onClick={onCreateClub} type="button">
              Create a new club
            </button>
          ) : (
            <small>New club proposals must be submitted by a registered student.</small>
          )}
        </div>
      </div>

      {ownRequests.length > 0 ? (
        <div className={styles.ownRequestList} aria-label="Your club requests">
          {ownRequests.map((request) => (
            <article key={request.id} data-status={request.status}>
              <div>
                <span>Your club request</span>
                <strong>{request.name}</strong>
              </div>
              <b>{request.status}</b>
            </article>
          ))}
        </div>
      ) : null}

      {clubs.length === 0 ? (
        <EmptyState
          title="No clubs available"
          description="CUET club profiles will appear here when club data is available."
        />
      ) : (
        <div className={styles.clubTabs} aria-label="CUET clubs">
          {clubs.map((club, index) => (
            <Link
              className={styles.clubTab}
              href={`${routes.clubs}/${club.id}`}
              key={club.id}
              style={{ "--club-accent": club.accent } as CSSProperties}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{club.shortName}</strong>
              <h3>{club.name}</h3>
              <p>{club.tagline}</p>
              {club.adminUserIds.includes(currentUserId) ? <em>Club admin</em> : null}
              <b>
                View club <span aria-hidden="true">→</span>
              </b>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

type CampusEventDirectoryProps = Readonly<{
  clubNames: ReadonlyMap<string, string>;
  eventCounts: Readonly<Record<EventFilter, number>>;
  eventFilter: EventFilter;
  events: readonly CampusEvent[];
  onAttendanceChange: (eventId: string, status: AttendanceStatus) => void;
  onFilterChange: (filter: EventFilter) => void;
}>;

function CampusEventDirectory({
  clubNames,
  eventCounts,
  eventFilter,
  events,
  onAttendanceChange,
  onFilterChange,
}: CampusEventDirectoryProps) {
  return (
    <section className={styles.eventDirectory} aria-labelledby="event-directory-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Campus-wide calendar</p>
          <h2 id="event-directory-title">What is happening at CUET</h2>
        </div>
        <p>
          Browse every listed event and mark the ones you are interested in or plan to
          attend.
        </p>
      </div>

      <div className={styles.eventFilters} aria-label="Filter events">
        {eventFilters.map((filter) => (
          <button
            aria-pressed={eventFilter === filter.id}
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            type="button"
          >
            <span>{filter.label}</span>
            <strong>{eventCounts[filter.id]}</strong>
          </button>
        ))}
      </div>

      <p className={styles.resultsSummary} aria-live="polite">
        Showing {events.length} {events.length === 1 ? "event" : "events"}
      </p>

      {events.length === 0 ? (
        <EmptyState
          title="No events in this view"
          description="Choose another status to explore the rest of the campus event calendar."
        />
      ) : (
        <div className={styles.eventGrid}>
          {events.map((event) => (
            <EventCard
              attendance={event.myInterest ?? "none"}
              clubName={clubNames.get(event.clubId) ?? "CUET student club"}
              event={event}
              key={event.id}
              onAttendanceChange={onAttendanceChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
