"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/ui/feedback/empty-state";
import { LoadingState } from "@/components/ui/feedback/loading-state";
import { useClubEvents } from "@/features/clubs-events/context/club-event-context";
import type { MembershipRequest } from "@/features/clubs-events/types/club-event";

import styles from "./club-event-hub.module.css";

export function MembershipRequestPage({ clubId }: Readonly<{ clubId: string }>) {
  const {
    snapshot,
    isClubAdmin,
    listMembershipRequests,
    approveMembershipRequest,
    removeMembershipRequest,
  } = useClubEvents();
  const club = snapshot.clubs.find((item) => item.id === clubId);
  const [requests, setRequests] = useState<readonly MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!club || !isClubAdmin(club)) return;

    let cancelled = false;
    listMembershipRequests(club.id)
      .then((result) => {
        if (!cancelled) setRequests(result);
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Membership requests could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [club, isClubAdmin, listMembershipRequests]);

  if (!club || !isClubAdmin(club)) {
    return (
      <AppShell className={styles.pageShell}>
        <EmptyState
          title="Club Admin access required"
          description="Only an administrator mapped to this club can review its membership requests."
        />
      </AppShell>
    );
  }

  async function review(requestId: string, decision: "approve" | "remove") {
    setBusyId(requestId);
    setError("");
    try {
      if (decision === "approve") {
        await approveMembershipRequest(clubId, requestId);
      } else {
        await removeMembershipRequest(clubId, requestId);
      }
      setRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The membership request could not be updated.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <AppShell className={styles.pageShell}>
      <Link className={styles.backLink} href={`/clubs/${club.id}`}>
        <span aria-hidden="true">←</span> Back to {club.shortName}
      </Link>
      <section className={styles.membershipRequestHero}>
        <p>Club administrator workspace</p>
        <h1>Membership requests</h1>
        <span>
          Review applicants for {club.name}. Approval immediately creates club
          membership and sends the student a notification.
        </span>
      </section>
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <LoadingState label="Loading membership requests" /> : null}
      {!loading && requests.length === 0 ? (
        <EmptyState
          title="No pending membership requests"
          description="New applications will appear here while recruitment is open."
        />
      ) : null}
      {!loading && requests.length > 0 ? (
        <div className={styles.membershipRequestList}>
          {requests.map((request) => (
            <article key={request.id}>
              <header>
                <div>
                  <span>{request.departmentName}</span>
                  <h2>{request.applicantName}</h2>
                  <p>
                    {request.studentId} · {request.email} · {request.phone}
                  </p>
                </div>
                <b>BDT {request.fee}</b>
              </header>
              <div className={styles.membershipRequestDetails}>
                <div>
                  <span>Payment method</span>
                  <strong>{request.paymentMethod}</strong>
                </div>
                <div>
                  <span>Transaction ID</span>
                  <strong>{request.transactionId}</strong>
                </div>
                <div>
                  <span>Submitted</span>
                  <strong>{request.submittedAt.slice(0, 10)}</strong>
                </div>
              </div>
              <div className={styles.membershipMotivation}>
                <span>Why this student wants to join</span>
                <p>{request.motivation}</p>
              </div>
              <footer>
                <button
                  disabled={Boolean(busyId)}
                  onClick={() => void review(request.id, "remove")}
                  type="button"
                >
                  Remove request
                </button>
                <button
                  disabled={Boolean(busyId)}
                  onClick={() => void review(request.id, "approve")}
                  type="button"
                >
                  {busyId === request.id ? "Updating…" : "Approve membership"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
