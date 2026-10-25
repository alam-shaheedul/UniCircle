"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useAuthenticatedUser } from "@/features/auth/context/authenticated-user-context";
import { useClubEvents } from "@/features/clubs-events/context/club-event-context";
import type {
  CampusClub,
  CampusEvent,
  CampusEventInput,
  ClubProfileInput,
  MembershipSettingsInput,
} from "@/features/clubs-events/types/club-event";

import styles from "./club-event-hub.module.css";

type WorkspaceSection = "profile" | "membership" | "admins" | "events";

function localDateTime(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ClubAdminWorkspace({ club }: Readonly<{ club: CampusClub }>) {
  const { user } = useAuthenticatedUser();
  const {
    snapshot,
    updateClub,
    updateMembershipSettings,
    addClubAdmin,
    removeClubAdmin,
    saveEvent,
    deleteEvent,
  } = useClubEvents();
  const [section, setSection] = useState<WorkspaceSection>("profile");
  const [editingEvent, setEditingEvent] = useState<CampusEvent | "new" | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const clubEvents = snapshot.events.filter((event) => event.clubId === club.id);
  const administrators = club.adminStudents ?? [];

  async function runBusy(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The club update could not be completed.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.clubAdminWorkspace} aria-labelledby="club-admin-title">
      <header className={styles.clubAdminHeader}>
        <div>
          <p>Club administrator access</p>
          <h2 id="club-admin-title">Manage {club.shortName}</h2>
          <span>
            Only mapped student admins can change this club, its admins, or its events.
          </span>
        </div>
        <b>Signed in as {user.displayName}</b>
      </header>

      <nav className={styles.clubAdminNavigation} aria-label="Club admin sections">
        {(
          [
            ["profile", "Club details"],
            ["membership", "Membership"],
            ["admins", "Student admins"],
            ["events", "Club events"],
          ] as const
        ).map(([id, label]) => (
          <button
            aria-pressed={section === id}
            key={id}
            onClick={() => setSection(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <div className={styles.formError}>{error}</div> : null}

      {section === "profile" ? (
        <ClubProfileForm
          busy={busy === "profile"}
          club={club}
          onSave={(input) => runBusy("profile", () => updateClub(club, input))}
        />
      ) : null}

      {section === "admins" ? (
        <AdminDirectory
          administrators={administrators}
          busy={busy}
          currentUserId={user.id}
          onAdd={(studentId) =>
            runBusy("add-admin", () => addClubAdmin(club, studentId))
          }
          onRemove={(userId) =>
            runBusy(`admin-${userId}`, () => removeClubAdmin(club, userId))
          }
        />
      ) : null}

      {section === "membership" ? (
        <MembershipManagement
          busy={busy === "membership-settings"}
          club={club}
          onSave={(input) =>
            runBusy("membership-settings", () => updateMembershipSettings(club, input))
          }
        />
      ) : null}

      {section === "events" ? (
        <div className={styles.clubEventManager}>
          <header>
            <div>
              <h3>Events managed by {club.shortName}</h3>
              <p>
                Add, update, or remove events and decide whether registration opens.
              </p>
            </div>
            <button onClick={() => setEditingEvent("new")} type="button">
              Add event
            </button>
          </header>

          {editingEvent ? (
            <EventManagementForm
              busy={busy === "event-form"}
              initial={editingEvent === "new" ? undefined : editingEvent}
              key={editingEvent === "new" ? "new-event" : editingEvent.id}
              onCancel={() => setEditingEvent(null)}
              onSave={(input, current) =>
                runBusy("event-form", async () => {
                  await saveEvent(club.id, input, current);
                  setEditingEvent(null);
                })
              }
            />
          ) : null}

          <div className={styles.managedEventList}>
            {clubEvents.map((event) => (
              <article key={event.id}>
                <div>
                  <span>{event.status}</span>
                  <h4>{event.title}</h4>
                  <p>
                    {event.registration.enabled
                      ? `${event.registeredCount} registered · ${event.registration.isPaid ? `BDT ${event.registration.feeAmount}` : "Free"}`
                      : "Registration not offered"}
                  </p>
                </div>
                <div>
                  <button onClick={() => setEditingEvent(event)} type="button">
                    Edit
                  </button>
                  <button
                    disabled={busy === `event-${event.id}`}
                    onClick={() =>
                      window.confirm(`Delete ${event.title}? This cannot be undone.`)
                        ? void runBusy(`event-${event.id}`, () => deleteEvent(event.id))
                        : undefined
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MembershipManagement({
  club,
  busy,
  onSave,
}: Readonly<{
  club: CampusClub;
  busy: boolean;
  onSave: (input: MembershipSettingsInput) => Promise<void>;
}>) {
  const [values, setValues] = useState<MembershipSettingsInput>({
    open: club.membershipRecruitment?.open ?? false,
    bkashNumber: club.membershipRecruitment?.bkashNumber ?? "",
    nagadNumber: club.membershipRecruitment?.nagadNumber ?? "",
  });

  return (
    <div className={styles.membershipManagement}>
      <form
        className={styles.managementForm}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(values);
        }}
      >
        <header>
          <div>
            <h3>Membership recruitment settings</h3>
            <p>The standard membership fee is fixed at BDT 200 for every club.</p>
          </div>
          <label className={styles.recruitmentToggle}>
            <input
              checked={values.open}
              onChange={(event) => setValues({ ...values, open: event.target.checked })}
              type="checkbox"
            />
            <span>{values.open ? "Recruitment open" : "Recruitment closed"}</span>
          </label>
        </header>
        <div className={styles.formGrid}>
          <TextField
            label="bKash personal number"
            required={values.open}
            value={values.bkashNumber}
            onChange={(bkashNumber) => setValues({ ...values, bkashNumber })}
          />
          <TextField
            label="Nagad personal number"
            required={values.open}
            value={values.nagadNumber}
            onChange={(nagadNumber) => setValues({ ...values, nagadNumber })}
          />
        </div>
        <div className={styles.formActions}>
          <button disabled={busy} type="submit">
            {busy ? "Saving…" : "Save recruitment settings"}
          </button>
        </div>
      </form>
      <Link
        className={styles.membershipRequestsLink}
        href={`/clubs/${club.id}/membership-requests`}
      >
        <span>
          <strong>See all Membership Requests</strong>
          <small>Review pending applications and payment transaction IDs.</small>
        </span>
        <b>{club.pendingMembershipRequestCount ?? 0}</b>
      </Link>
    </div>
  );
}

function ClubProfileForm({
  club,
  busy,
  onSave,
}: Readonly<{
  club: CampusClub;
  busy: boolean;
  onSave: (input: ClubProfileInput) => Promise<void>;
}>) {
  const [values, setValues] = useState<ClubProfileInput>({
    name: club.name,
    shortName: club.shortName,
    category: club.category,
    tagline: club.tagline,
    description: club.description,
    activities: club.activities.join("\n"),
  });

  return (
    <form
      className={styles.managementForm}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(values);
      }}
    >
      <div className={styles.formGrid}>
        <TextField
          label="Club name"
          value={values.name}
          onChange={(name) => setValues({ ...values, name })}
        />
        <TextField
          label="Short name"
          value={values.shortName}
          onChange={(shortName) => setValues({ ...values, shortName })}
        />
        <TextField
          label="Category"
          value={values.category}
          onChange={(category) => setValues({ ...values, category })}
        />
        <TextField
          label="Tagline"
          value={values.tagline}
          onChange={(tagline) => setValues({ ...values, tagline })}
        />
        <label className={styles.wideField}>
          <span>Description</span>
          <textarea
            onChange={(event) =>
              setValues({ ...values, description: event.target.value })
            }
            required
            rows={4}
            value={values.description}
          />
        </label>
        <label className={styles.wideField}>
          <span>Activities · one per line</span>
          <textarea
            onChange={(event) =>
              setValues({ ...values, activities: event.target.value })
            }
            required
            rows={5}
            value={values.activities}
          />
        </label>
      </div>
      <div className={styles.formActions}>
        <button disabled={busy} type="submit">
          {busy ? "Saving…" : "Save club details"}
        </button>
      </div>
    </form>
  );
}

function AdminDirectory({
  administrators,
  currentUserId,
  busy,
  onAdd,
  onRemove,
}: Readonly<{
  administrators: ReturnType<typeof useClubEvents>["snapshot"]["students"];
  currentUserId: string;
  busy: string;
  onAdd: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}>) {
  const [studentId, setStudentId] = useState("");

  return (
    <div className={styles.clubAdminDirectory}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (studentId.trim()) void onAdd(studentId.trim());
        }}
      >
        <label>
          <span>Registered student ID</span>
          <input
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="e.g. 2204067"
            required
            value={studentId}
          />
        </label>
        <button disabled={!studentId.trim() || Boolean(busy)} type="submit">
          Make club admin
        </button>
      </form>

      <div>
        {administrators.map((student) => (
          <article key={student.userId}>
            <div>
              <strong>{student.name}</strong>
              <p>
                {student.studentId} · {student.department}
              </p>
              {student.email ? <small>{student.email}</small> : null}
            </div>
            <button
              disabled={Boolean(busy) || administrators.length === 1}
              onClick={() => void onRemove(student.userId)}
              type="button"
            >
              {student.userId === currentUserId ? "Remove my access" : "Remove admin"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function EventManagementForm({
  initial,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  initial?: CampusEvent;
  busy: boolean;
  onSave: (input: CampusEventInput, current?: CampusEvent) => Promise<void>;
  onCancel: () => void;
}>) {
  const [values, setValues] = useState<CampusEventInput>({
    title: initial?.title ?? "",
    category: initial?.category ?? "",
    summary: initial?.summary ?? "",
    location: initial?.location ?? "",
    startsAt: initial ? localDateTime(initial.startsAt) : "",
    endsAt: initial ? localDateTime(initial.endsAt) : "",
    status: initial?.status ?? "upcoming",
    registration: initial?.registration ?? { enabled: false, isPaid: false },
  });

  const registration = values.registration;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(values, initial);
  }

  return (
    <form className={styles.eventManagementForm} onSubmit={submit}>
      <header>
        <div>
          <p>Club event editor</p>
          <h3>{initial ? "Update event" : "Create a new event"}</h3>
        </div>
        <button onClick={onCancel} type="button">
          Close
        </button>
      </header>
      <div className={styles.formGrid}>
        <TextField
          label="Event title"
          value={values.title}
          onChange={(title) => setValues({ ...values, title })}
        />
        <TextField
          label="Category"
          value={values.category}
          onChange={(category) => setValues({ ...values, category })}
        />
        <TextField
          label="Venue"
          value={values.location}
          onChange={(location) => setValues({ ...values, location })}
        />
        <label>
          <span>Starts at</span>
          <input
            onChange={(event) => setValues({ ...values, startsAt: event.target.value })}
            required
            type="datetime-local"
            value={values.startsAt}
          />
        </label>
        <label>
          <span>Ends at</span>
          <input
            onChange={(event) => setValues({ ...values, endsAt: event.target.value })}
            required
            type="datetime-local"
            value={values.endsAt}
          />
        </label>
        <label className={styles.wideField}>
          <span>Event summary</span>
          <textarea
            onChange={(event) => setValues({ ...values, summary: event.target.value })}
            required
            rows={4}
            value={values.summary}
          />
        </label>
      </div>

      <fieldset className={styles.registrationSettings}>
        <legend>Registration settings</legend>
        <label className={styles.checkField}>
          <input
            checked={registration.enabled}
            onChange={(event) =>
              setValues({
                ...values,
                registration: {
                  ...registration,
                  enabled: event.target.checked,
                  isPaid: event.target.checked ? registration.isPaid : false,
                },
              })
            }
            type="checkbox"
          />
          <span>Add an event registration form</span>
        </label>
        {registration.enabled ? (
          <>
            <label className={styles.checkField}>
              <input
                checked={registration.isPaid}
                onChange={(event) =>
                  setValues({
                    ...values,
                    registration: {
                      ...registration,
                      isPaid: event.target.checked,
                    },
                  })
                }
                type="checkbox"
              />
              <span>This is a paid event</span>
            </label>
            {registration.isPaid ? (
              <div className={styles.formGrid}>
                <label>
                  <span>Registration fee (BDT)</span>
                  <input
                    min="1"
                    onChange={(event) =>
                      setValues({
                        ...values,
                        registration: {
                          ...registration,
                          feeAmount: Number(event.target.value),
                        },
                      })
                    }
                    required
                    type="number"
                    value={registration.feeAmount ?? ""}
                  />
                </label>
                <label>
                  <span>bKash number</span>
                  <input
                    onChange={(event) =>
                      setValues({
                        ...values,
                        registration: {
                          ...registration,
                          bkashNumber: event.target.value,
                        },
                      })
                    }
                    required
                    type="tel"
                    value={registration.bkashNumber ?? ""}
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : null}
      </fieldset>

      <div className={styles.formActions}>
        <button disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
        <button disabled={busy} type="submit">
          {busy ? "Saving…" : initial ? "Update event" : "Create event"}
        </button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = true,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}>) {
  return (
    <label>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      />
    </label>
  );
}
