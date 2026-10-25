"use client";

import { useState } from "react";

import { useClubEvents } from "@/features/clubs-events/context/club-event-context";
import type {
  ClubCreationRequest,
  ClubRequestStatus,
} from "@/features/clubs-events/types/club-event";

import styles from "./admin-page.module.css";

const requestDateFormatter = new Intl.DateTimeFormat("en-BD", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminClubRequestManager() {
  const { snapshot, reviewClubRequest } = useClubEvents();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const pendingCount = snapshot.clubRequests.filter(
    (request) => request.status === "pending",
  ).length;

  async function review(
    request: ClubCreationRequest,
    status: Exclude<ClubRequestStatus, "pending">,
  ) {
    setBusyId(request.id);
    setError("");
    try {
      await reviewClubRequest(request, status);
    } catch {
      setError("The club request could not be reviewed. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className={styles.managerSection} aria-labelledby="club-requests-title">
      <header className={styles.sectionHeading}>
        <div>
          <p>Student organization governance</p>
          <h2 id="club-requests-title">Club creation requests</h2>
        </div>
        <span>{pendingCount} awaiting review</span>
      </header>

      {error ? <div className={styles.actionError}>{error}</div> : null}

      {snapshot.clubRequests.length === 0 ? (
        <div className={styles.adminEmptyState}>
          <h3>No club requests</h3>
          <p>Student club proposals will appear here for App Admin approval.</p>
        </div>
      ) : (
        <div className={styles.clubRequestQueue}>
          {snapshot.clubRequests.map((request) => (
            <article data-status={request.status} key={request.id}>
              <header>
                <div>
                  <span>{request.status}</span>
                  <h3>{request.name}</h3>
                  <p>
                    {request.shortName} · {request.category}
                  </p>
                </div>
                <time dateTime={request.submittedAt}>
                  {requestDateFormatter.format(new Date(request.submittedAt))}
                </time>
              </header>

              <p className={styles.clubRequestTagline}>{request.tagline}</p>
              <p className={styles.clubRequestDescription}>{request.description}</p>
              <div className={styles.clubRequestPurpose}>
                <strong>Purpose and campus need</strong>
                <p>{request.purpose}</p>
              </div>

              <div className={styles.clubRequestActivities}>
                <strong>Planned activities</strong>
                <ul>
                  {request.activities.map((activity) => (
                    <li key={activity}>{activity}</li>
                  ))}
                </ul>
              </div>

              <dl>
                <div>
                  <dt>Requested by</dt>
                  <dd>{request.requestedByName}</dd>
                </div>
                <div>
                  <dt>Student ID</dt>
                  <dd>{request.requestedByStudentId}</dd>
                </div>
                <div>
                  <dt>Planned activities</dt>
                  <dd>{request.activities.length} listed</dd>
                </div>
              </dl>

              {request.status === "pending" ? (
                <div className={styles.moderationActions}>
                  <button
                    disabled={busyId === request.id}
                    onClick={() => void review(request, "rejected")}
                    type="button"
                  >
                    Reject request
                  </button>
                  <button
                    disabled={busyId === request.id}
                    onClick={() => void review(request, "approved")}
                    type="button"
                  >
                    Approve &amp; create club
                  </button>
                </div>
              ) : (
                <p className={styles.resolutionNote}>
                  {request.status === "approved"
                    ? "Approved. The club is public and the requester is its initial club admin."
                    : "Rejected. No club was created."}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
