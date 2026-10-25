"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import type { ClubCreationRequestInput } from "@/features/clubs-events/types/club-event";

import styles from "./club-event-hub.module.css";

export function ClubCreationRequestForm({
  onClose,
  onSubmit,
}: Readonly<{
  onClose: () => void;
  onSubmit: (input: ClubCreationRequestInput) => Promise<void>;
}>) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<ClubCreationRequestInput>({
    name: "",
    shortName: "",
    category: "",
    tagline: "",
    description: "",
    purpose: "",
    activities: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    firstFieldRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await onSubmit(values);
      onClose();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The club request could not be submitted.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} role="presentation">
      <section
        aria-labelledby="club-request-title"
        aria-modal="true"
        className={styles.clubRequestModal}
        role="dialog"
      >
        <header>
          <div>
            <p>Student club proposal</p>
            <h2 id="club-request-title">Request a new CUET club</h2>
          </div>
          <button aria-label="Close club request form" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <p className={styles.modalIntro}>
          The UniCircle App Admin will review this proposal. If approved, the club
          becomes public and you become its first club admin.
        </p>

        {error ? <div className={styles.formError}>{error}</div> : null}

        <form className={styles.managementForm} onSubmit={submit}>
          <div className={styles.formGrid}>
            <label>
              <span>Club name</span>
              <input
                maxLength={90}
                onChange={(event) => setValues({ ...values, name: event.target.value })}
                ref={firstFieldRef}
                required
                value={values.name}
              />
            </label>
            <label>
              <span>Short name</span>
              <input
                maxLength={18}
                onChange={(event) =>
                  setValues({ ...values, shortName: event.target.value })
                }
                required
                value={values.shortName}
              />
            </label>
            <label>
              <span>Category</span>
              <input
                maxLength={70}
                onChange={(event) =>
                  setValues({ ...values, category: event.target.value })
                }
                placeholder="Technology, culture, wellbeing…"
                required
                value={values.category}
              />
            </label>
            <label>
              <span>Tagline</span>
              <input
                maxLength={100}
                onChange={(event) =>
                  setValues({ ...values, tagline: event.target.value })
                }
                required
                value={values.tagline}
              />
            </label>
            <label className={styles.wideField}>
              <span>Club description</span>
              <textarea
                maxLength={700}
                onChange={(event) =>
                  setValues({ ...values, description: event.target.value })
                }
                required
                rows={4}
                value={values.description}
              />
            </label>
            <label className={styles.wideField}>
              <span>Why should this club be created?</span>
              <textarea
                maxLength={900}
                onChange={(event) =>
                  setValues({ ...values, purpose: event.target.value })
                }
                placeholder="Explain the purpose, campus need, and expected impact."
                required
                rows={5}
                value={values.purpose}
              />
            </label>
            <label className={styles.wideField}>
              <span>Planned activities</span>
              <textarea
                onChange={(event) =>
                  setValues({ ...values, activities: event.target.value })
                }
                placeholder="Enter one activity per line"
                required
                rows={4}
                value={values.activities}
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button disabled={isSubmitting} onClick={onClose} type="button">
              Cancel
            </button>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending request…" : "Send club request"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
