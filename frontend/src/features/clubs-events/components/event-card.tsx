import Link from "next/link";

import { routes } from "@/config/routes";
import type {
  AttendanceStatus,
  CampusEvent,
} from "@/features/clubs-events/types/club-event";
import {
  formatEventEnd,
  formatEventStart,
} from "@/features/clubs-events/lib/format-event-date";

import styles from "./club-event-hub.module.css";

type EventCardProps = Readonly<{
  event: CampusEvent;
  clubName: string;
  attendance: AttendanceStatus;
  onAttendanceChange: (eventId: string, status: AttendanceStatus) => void;
  compact?: boolean;
}>;

const statusLabels = {
  ongoing: "Happening now",
  upcoming: "Upcoming",
  finished: "Recently finished",
} as const satisfies Record<CampusEvent["status"], string>;

export function EventCard({
  event,
  clubName,
  attendance,
  onAttendanceChange,
  compact = false,
}: EventCardProps) {
  const displayedAttendance = event.attendeeCount;

  return (
    <article
      className={`${styles.eventCard} ${compact ? styles.eventCardCompact : ""}`}
      data-status={event.status}
      id={`event-${event.id}`}
    >
      <div className={styles.eventCardTopline}>
        <span className={styles.eventStatus} data-status={event.status}>
          {statusLabels[event.status]}
        </span>
        <span>{event.category}</span>
      </div>

      <div className={styles.eventCardBody}>
        <p className={styles.eventClub}>{clubName}</p>
        <h3>{event.title}</h3>
        <p>{event.summary}</p>
      </div>

      <dl className={styles.eventSchedule}>
        <div>
          <dt>Starts</dt>
          <dd>
            <time dateTime={event.startsAt}>{formatEventStart(event.startsAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Ends</dt>
          <dd>
            <time dateTime={event.endsAt}>
              {formatEventEnd(event.startsAt, event.endsAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>{event.location}</dd>
        </div>
      </dl>

      <footer className={styles.eventCardFooter}>
        <div className={styles.eventParticipationCounts}>
          <span>{displayedAttendance} going</span>
          {event.registration.enabled ? (
            <span>{event.registeredCount} registered</span>
          ) : null}
        </div>
        {event.status === "finished" ? (
          <strong>Event concluded</strong>
        ) : (
          <div className={styles.attendanceActions}>
            <button
              type="button"
              aria-pressed={attendance === "interested"}
              onClick={() => onAttendanceChange(event.id, "interested")}
            >
              Interested
            </button>
            <button
              type="button"
              aria-pressed={attendance === "going"}
              onClick={() => onAttendanceChange(event.id, "going")}
            >
              Going
            </button>
          </div>
        )}
      </footer>

      <div className={styles.eventRegistrationAction}>
        <Link href={`${routes.events}/${event.id}`}>
          {event.registration.enabled && event.status !== "finished"
            ? "View details & register"
            : "View event details"}
          <span aria-hidden="true">→</span>
        </Link>
        {event.registration.enabled && event.registration.isPaid ? (
          <small>Paid registration · BDT {event.registration.feeAmount}</small>
        ) : event.registration.enabled ? (
          <small>Free registration available</small>
        ) : (
          <small>No registration form for this event</small>
        )}
      </div>
    </article>
  );
}
