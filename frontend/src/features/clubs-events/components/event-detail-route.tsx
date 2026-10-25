"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/ui/feedback/empty-state";
import { routes } from "@/config/routes";
import { useAuthenticatedUser } from "@/features/auth/context/authenticated-user-context";
import { useClubEvents } from "@/features/clubs-events/context/club-event-context";
import {
  formatEventEnd,
  formatEventStart,
} from "@/features/clubs-events/lib/format-event-date";
import type { EventRegistrationInput } from "@/features/clubs-events/types/club-event";

import styles from "./club-event-hub.module.css";

export function EventDetailRoute({ eventId }: Readonly<{ eventId: string }>) {
  const { user } = useAuthenticatedUser();
  const { snapshot, registerForEvent, hasRegistered } = useClubEvents();
  const event = snapshot.events.find((item) => item.id === eventId);
  const club = event
    ? snapshot.clubs.find((item) => item.id === event.clubId)
    : undefined;
  const [values, setValues] = useState<EventRegistrationInput>({
    name: user.displayName,
    email: user.role === "student" ? user.email : "",
    studentId: user.role === "student" ? user.universityId : "",
    department: user.role === "student" ? user.department : "",
    bkashTransactionId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!event) {
    return (
      <AppShell>
        <EmptyState
          title={snapshot.loadError ? "Events could not be loaded" : "Event not found"}
          description={
            snapshot.loadError ??
            "This event may have been removed by its club administrators."
          }
        />
      </AppShell>
    );
  }

  const alreadyRegistered = hasRegistered(event.id);
  const canRegister =
    event.registration.enabled &&
    event.status === "upcoming" &&
    user.role === "student";

  async function submit(eventObject: FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    if (!event) return;
    setIsSubmitting(true);
    setError("");
    try {
      await registerForEvent(event, values);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Event registration could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell className={styles.pageShell}>
      <Link className={styles.backLink} href={routes.events}>
        <span aria-hidden="true">←</span> All events
      </Link>

      <section className={styles.eventDetailHero} aria-labelledby="event-detail-title">
        <div>
          <p>{club?.name ?? "CUET student club"}</p>
          <h1 id="event-detail-title">{event.title}</h1>
          <span>{event.summary}</span>
        </div>
        <dl>
          <div>
            <dt>Starts</dt>
            <dd>{formatEventStart(event.startsAt)}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{formatEventEnd(event.startsAt, event.endsAt)}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{event.location}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.eventDetailLayout}>
        <section
          className={styles.registrationPanel}
          aria-labelledby="registration-title"
        >
          <header>
            <div>
              <p>Event registration</p>
              <h2 id="registration-title">
                {canRegister ? "Reserve your place" : "Registration information"}
              </h2>
            </div>
            <span>{event.registeredCount} registered</span>
          </header>

          {!event.registration.enabled ? (
            <div className={styles.registrationUnavailable}>
              <strong>No registration form was added</strong>
              <p>You can still mark this event as Interested or Going.</p>
            </div>
          ) : event.status !== "upcoming" ? (
            <div className={styles.registrationUnavailable}>
              <strong>Registration has closed</strong>
              <p>Registration closes when the event starts.</p>
            </div>
          ) : user.role !== "student" ? (
            <div className={styles.registrationUnavailable}>
              <strong>Student registration only</strong>
              <p>Sign in with a registered student account to join this event.</p>
            </div>
          ) : alreadyRegistered ? (
            <div className={styles.registrationSuccess} role="status">
              <strong>
                {event.registration.isPaid
                  ? "Registration submitted"
                  : "You are registered"}
              </strong>
              <p>
                {event.registration.isPaid
                  ? `Payment status: ${event.myRegistration?.paymentStatus ?? "pending review"}. The club must verify your bKash transaction.`
                  : "The club now has your submitted participant information."}
              </p>
            </div>
          ) : (
            <>
              {event.registration.isPaid ? (
                <div className={styles.paymentNotice}>
                  <span>Paid event · BDT {event.registration.feeAmount}</span>
                  <strong>
                    Send payment to bKash {event.registration.bkashNumber}
                  </strong>
                  <p>Enter the transaction ID below after completing payment.</p>
                </div>
              ) : (
                <div className={styles.freeNotice}>Free event registration</div>
              )}

              {error ? <div className={styles.formError}>{error}</div> : null}
              <form className={styles.managementForm} onSubmit={submit}>
                <div className={styles.formGrid}>
                  <RegistrationField
                    label="Full name"
                    value={values.name}
                    onChange={(name) => setValues({ ...values, name })}
                  />
                  <RegistrationField
                    label="CUET email"
                    type="email"
                    value={values.email}
                    onChange={(email) => setValues({ ...values, email })}
                  />
                  <RegistrationField
                    label="Student ID"
                    value={values.studentId}
                    onChange={(studentId) => setValues({ ...values, studentId })}
                  />
                  <RegistrationField
                    label="Department name"
                    value={values.department}
                    onChange={(department) => setValues({ ...values, department })}
                  />
                  {event.registration.isPaid ? (
                    <RegistrationField
                      label="bKash transaction ID"
                      value={values.bkashTransactionId ?? ""}
                      onChange={(bkashTransactionId) =>
                        setValues({ ...values, bkashTransactionId })
                      }
                    />
                  ) : null}
                </div>
                <div className={styles.formActions}>
                  <button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Registering…" : "Complete registration"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <aside className={styles.registrationSummary}>
          <span>Registration policy</span>
          <h2>{event.registration.isPaid ? "Payment required" : "Student details"}</h2>
          <p>
            Registration is managed by the club. Your name, CUET email, student ID, and
            department are submitted with this form.
          </p>
          <dl>
            <div>
              <dt>Event status</dt>
              <dd>{event.status}</dd>
            </div>
            <div>
              <dt>Registration</dt>
              <dd>{event.registration.enabled ? "Enabled" : "Not offered"}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </AppShell>
  );
}

function RegistrationField({
  label,
  value,
  onChange,
  type = "text",
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
}>) {
  return (
    <label>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
