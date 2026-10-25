"use client";

import { useState, type FormEvent } from "react";

import { useAuthenticatedUser } from "@/features/auth/context/authenticated-user-context";
import { useClubEvents } from "@/features/clubs-events/context/club-event-context";
import type {
  CampusClub,
  MembershipRequestInput,
} from "@/features/clubs-events/types/club-event";

import styles from "./club-event-hub.module.css";

export function MembershipRecruitmentPanel({ club }: Readonly<{ club: CampusClub }>) {
  const { user } = useAuthenticatedUser();
  const { submitMembershipRequest } = useClubEvents();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recruitment = club.membershipRecruitment;

  if (club.isMember) {
    return (
      <section className={styles.membershipStatus} data-status="member">
        <span aria-hidden="true">✓</span>
        <div>
          <h2>You are the member of this club</h2>
          <p>Your approved membership is active.</p>
        </div>
      </section>
    );
  }

  if (club.membershipRequestStatus === "pending") {
    return (
      <section className={styles.membershipStatus} data-status="pending">
        <span aria-hidden="true">…</span>
        <div>
          <h2>Membership request under review</h2>
          <p>The club administrators will review your submitted application.</p>
        </div>
      </section>
    );
  }

  if (!recruitment?.open) {
    return (
      <section className={styles.membershipStatus} data-status="closed">
        <span aria-hidden="true">i</span>
        <div>
          <h2>Membership recruitment is closed</h2>
          <p>Currently this club is not recruiting any members.</p>
        </div>
      </section>
    );
  }

  if (user.role !== "student") {
    return (
      <section className={styles.membershipStatus} data-status="closed">
        <span aria-hidden="true">i</span>
        <div>
          <h2>Student membership</h2>
          <p>Only registered CUET student accounts can apply for club membership.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.membershipRecruitment}>
      <header>
        <div>
          <p>Membership recruitment</p>
          <h2>Become a member of {club.shortName}</h2>
          <span>
            Complete the application and submit the standard BDT 200 membership fee.
          </span>
        </div>
        <button onClick={() => setShowForm((current) => !current)} type="button">
          {showForm ? "Close form" : "Be a member"}
        </button>
      </header>

      {showForm ? (
        <MembershipForm
          busy={busy}
          club={club}
          error={error}
          initial={{
            applicantName: user.displayName,
            email: user.email,
            studentId: user.universityId,
            departmentName: user.department,
            phone: user.phone,
            motivation: "",
            paymentMethod: "bkash",
            transactionId: "",
          }}
          onSubmit={async (input) => {
            setBusy(true);
            setError("");
            try {
              await submitMembershipRequest(club, input);
              setShowForm(false);
            } catch (caughtError) {
              setError(
                caughtError instanceof Error
                  ? caughtError.message
                  : "The membership request could not be submitted.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function MembershipForm({
  club,
  initial,
  busy,
  error,
  onSubmit,
}: Readonly<{
  club: CampusClub;
  initial: MembershipRequestInput;
  busy: boolean;
  error: string;
  onSubmit: (input: MembershipRequestInput) => Promise<void>;
}>) {
  const [values, setValues] = useState(initial);
  const recruitment = club.membershipRecruitment;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(values);
  }

  return (
    <form className={styles.membershipForm} onSubmit={submit}>
      <div className={styles.membershipPaymentNotice}>
        <div>
          <span>Standard fee</span>
          <strong>BDT {recruitment?.fee ?? 200}</strong>
        </div>
        <div>
          <span>bKash personal</span>
          <strong>{recruitment?.bkashNumber}</strong>
        </div>
        <div>
          <span>Nagad personal</span>
          <strong>{recruitment?.nagadNumber}</strong>
        </div>
      </div>
      <p className={styles.membershipPaymentHelp}>
        Send exactly BDT 200 using either payment account, then provide the matching
        transaction ID below.
      </p>
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.formGrid}>
        <MembershipField
          label="Full name"
          value={values.applicantName}
          onChange={(applicantName) => setValues({ ...values, applicantName })}
        />
        <MembershipField
          label="CUET email"
          readOnly
          type="email"
          value={values.email}
          onChange={(email) => setValues({ ...values, email })}
        />
        <MembershipField
          label="Student ID"
          readOnly
          value={values.studentId}
          onChange={(studentId) => setValues({ ...values, studentId })}
        />
        <MembershipField
          label="Department"
          value={values.departmentName}
          onChange={(departmentName) => setValues({ ...values, departmentName })}
        />
        <MembershipField
          label="Phone number"
          pattern="01[0-9]{9}"
          type="tel"
          value={values.phone}
          onChange={(phone) => setValues({ ...values, phone })}
        />
        <label>
          <span>Payment method</span>
          <select
            onChange={(event) =>
              setValues({
                ...values,
                paymentMethod: event.target.value as "bkash" | "nagad",
              })
            }
            value={values.paymentMethod}
          >
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
          </select>
        </label>
        <MembershipField
          label="Transaction ID"
          value={values.transactionId}
          onChange={(transactionId) => setValues({ ...values, transactionId })}
        />
        <label className={styles.wideField}>
          <span>Why do you want to join this club?</span>
          <textarea
            minLength={20}
            onChange={(event) =>
              setValues({ ...values, motivation: event.target.value })
            }
            required
            rows={5}
            value={values.motivation}
          />
        </label>
      </div>
      <div className={styles.formActions}>
        <button disabled={busy} type="submit">
          {busy ? "Submitting…" : "Send membership request"}
        </button>
      </div>
    </form>
  );
}

function MembershipField({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  pattern,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  pattern?: string;
}>) {
  return (
    <label>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        pattern={pattern}
        readOnly={readOnly}
        required
        type={type}
        value={value}
      />
    </label>
  );
}
