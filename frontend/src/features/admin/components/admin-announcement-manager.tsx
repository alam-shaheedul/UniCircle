"use client";

import { useState, type FormEvent } from "react";

import type { AdminSnapshotSetter } from "@/features/admin/components/admin-page";
import type {
  AdminAnnouncement,
  AdminAnnouncementInput,
  AdminSnapshot,
} from "@/features/admin/types/admin";
import { adminService } from "@/services";

import styles from "./admin-page.module.css";

const updatedAtFormatter = new Intl.DateTimeFormat("en-BD", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminAnnouncementManager({
  snapshot,
  setSnapshot,
}: Readonly<{ snapshot: AdminSnapshot; setSnapshot: AdminSnapshotSetter }>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const editingItem = snapshot.announcements.find((item) => item.id === editingId);

  async function save(input: AdminAnnouncementInput, id?: string) {
    setBusyId("form");
    setError("");
    try {
      const saved = await adminService.saveAnnouncement(input, id);
      setSnapshot((current) => ({
        ...current,
        announcements: current.announcements.some((item) => item.id === saved.id)
          ? current.announcements.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current.announcements],
      }));
      setEditingId(null);
      setIsAdding(false);
    } catch {
      setError("The announcement could not be saved. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    await adminService.deleteAnnouncement(id);
    setSnapshot((current) => ({
      ...current,
      announcements: current.announcements.filter((item) => item.id !== id),
    }));
    setBusyId("");
  }

  async function toggleStatus(item: AdminAnnouncement) {
    setBusyId(item.id);
    const saved = await adminService.setAnnouncementStatus(
      item,
      item.status === "published" ? "draft" : "published",
    );
    setSnapshot((current) => ({
      ...current,
      announcements: current.announcements.map((currentItem) =>
        currentItem.id === saved.id ? saved : currentItem,
      ),
    }));
    setBusyId("");
  }

  return (
    <section className={styles.managerSection} aria-labelledby="announcement-title">
      <header className={styles.sectionHeading}>
        <div>
          <p>Authorized publishing</p>
          <h2 id="announcement-title">News &amp; announcements</h2>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setIsAdding(true);
          }}
          type="button"
        >
          Add announcement
        </button>
      </header>

      {error ? <div className={styles.actionError}>{error}</div> : null}

      {isAdding || editingItem ? (
        <div className={styles.editorPanel}>
          <AnnouncementForm
            busy={busyId === "form"}
            initial={editingItem}
            key={editingItem?.id ?? "new-announcement"}
            onCancel={() => {
              setEditingId(null);
              setIsAdding(false);
            }}
            onSave={save}
          />
        </div>
      ) : null}

      <div className={styles.announcementList}>
        {snapshot.announcements.map((item) => (
          <article key={item.id}>
            <div className={styles.announcementMeta}>
              <span data-status={item.status}>{item.status}</span>
              <span>{item.type}</span>
              <time dateTime={item.updatedAt}>
                Updated {updatedAtFormatter.format(new Date(item.updatedAt))}
              </time>
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <div className={styles.audienceLine}>Audience: {item.audience}</div>
            <div className={styles.cardActions}>
              <button
                disabled={busyId === item.id}
                onClick={() => void toggleStatus(item)}
                type="button"
              >
                {busyId === item.id
                  ? "Updating..."
                  : item.status === "published"
                    ? "Move to draft"
                    : "Publish"}
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(item.id);
                }}
                type="button"
              >
                Edit
              </button>
              <button
                disabled={busyId === item.id}
                onClick={() => void remove(item.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnnouncementForm({
  initial,
  busy,
  onSave,
  onCancel,
}: Readonly<{
  initial?: AdminAnnouncement;
  busy: boolean;
  onSave: (input: AdminAnnouncementInput, id?: string) => Promise<void>;
  onCancel: () => void;
}>) {
  const [values, setValues] = useState<AdminAnnouncementInput>({
    type: initial?.type ?? "announcement",
    title: initial?.title ?? "",
    summary: initial?.summary ?? "",
    content: initial?.content ?? "",
    audience: initial?.audience ?? "CUET community",
    status: initial?.status ?? "draft",
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(values, initial?.id);
  }

  return (
    <form className={styles.adminForm} onSubmit={submit}>
      <header className={styles.formHeading}>
        <div>
          <p>Publishing form</p>
          <h3>{initial ? "Edit information item" : "Create information item"}</h3>
        </div>
        <span>Save as a draft or publish immediately.</span>
      </header>
      <div className={styles.formGrid}>
        <label className={styles.adminField}>
          <span>Content type</span>
          <select
            value={values.type}
            onChange={(event) =>
              setValues({
                ...values,
                type: event.target.value as AdminAnnouncementInput["type"],
              })
            }
          >
            <option value="news">News</option>
            <option value="update">Update</option>
            <option value="announcement">Announcement</option>
          </select>
        </label>
        <label className={styles.adminField}>
          <span>Audience</span>
          <input
            required
            value={values.audience}
            onChange={(event) => setValues({ ...values, audience: event.target.value })}
          />
        </label>
        <label className={`${styles.adminField} ${styles.wideField}`}>
          <span>Title</span>
          <input
            required
            value={values.title}
            onChange={(event) => setValues({ ...values, title: event.target.value })}
          />
        </label>
        <label className={`${styles.adminField} ${styles.wideField}`}>
          <span>Summary</span>
          <textarea
            required
            rows={4}
            value={values.summary}
            onChange={(event) => setValues({ ...values, summary: event.target.value })}
          />
        </label>
        <label className={`${styles.adminField} ${styles.wideField}`}>
          <span>Full information</span>
          <textarea
            required
            rows={8}
            value={values.content}
            onChange={(event) => setValues({ ...values, content: event.target.value })}
            placeholder="Write the complete information. Separate paragraphs with a blank line."
          />
        </label>
        <label className={styles.adminField}>
          <span>Initial state</span>
          <select
            value={values.status}
            onChange={(event) =>
              setValues({
                ...values,
                status: event.target.value as AdminAnnouncementInput["status"],
              })
            }
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
      <div className={styles.formActions}>
        <button disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
        <button disabled={busy} type="submit">
          {busy ? "Saving..." : "Save item"}
        </button>
      </div>
    </form>
  );
}
