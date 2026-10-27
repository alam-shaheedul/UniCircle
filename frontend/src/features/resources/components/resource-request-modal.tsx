"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  resourceCategories,
  type NewResourceRequest,
  type ResourceCategory,
  type ResourcePerson,
} from "@/features/resources/types/resource-sharing";

import styles from "./resource-sharing.module.css";

type ResourceRequestModalProps = Readonly<{
  person: ResourcePerson;
  error: string | null;
  onClose: () => void;
  onSubmit: (request: NewResourceRequest) => Promise<void>;
}>;

export function ResourceRequestModal({
  person,
  error,
  onClose,
  onSubmit,
}: ResourceRequestModalProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const [category, setCategory] = useState<ResourceCategory>(
    person.resourceCategories[0] ?? "notebook",
  );
  const [resourceName, setResourceName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    firstFieldRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const categoryLabel =
      resourceCategories.find((item) => item.id === category)?.label ?? "Resource";

    await onSubmit({
      receiverId: person.id,
      category,
      resourceName: resourceName.trim() || categoryLabel,
      message: message.trim(),
    });
  }

  return (
    <div className={styles.modalBackdrop} role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.requestModal}
        role="dialog"
      >
        <header>
          <div>
            <p>Resource request</p>
            <h2 id={titleId}>Ask {person.name}</h2>
          </div>
          <button aria-label="Close request form" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <p className={styles.modalIntro}>
          Describe what you need and when. Chat becomes available only if the request is
          accepted.
        </p>
        {error ? (
          <p className={styles.resourceError} role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <label>
            <span>Resource category</span>
            <select
              onChange={(event) => setCategory(event.target.value as ResourceCategory)}
              ref={firstFieldRef}
              value={category}
            >
              {resourceCategories
                .filter((item) => person.resourceCategories.includes(item.id))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>

          <label>
            <span>What do you need?</span>
            <input
              maxLength={80}
              onChange={(event) => setResourceName(event.target.value)}
              placeholder="For example: Level 2 circuits notebook"
              required={category === "other"}
              value={resourceName}
            />
          </label>

          <label>
            <span>Request message</span>
            <textarea
              maxLength={320}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Explain when you need it and how long you plan to use it."
              required
              rows={5}
              value={message}
            />
            <small>{message.length}/320</small>
          </label>

          <div className={styles.modalActions}>
            <button onClick={onClose} type="button">
              Cancel
            </button>
            <button type="submit">Send request</button>
          </div>
        </form>
      </section>
    </div>
  );
}
