"use client";

import { useState, type FormEvent } from "react";

import {
  resourceCategories,
  type ResourceCategory,
  type ResourceProfile,
} from "@/features/resources/types/resource-sharing";

import styles from "./resource-sharing.module.css";

type Props = Readonly<{
  profile: ResourceProfile;
  onSave: (profile: ResourceProfile) => Promise<boolean>;
}>;

export function ResourceProfileEditor({ profile, onSave }: Props) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  function toggleCategory(category: ResourceCategory) {
    setDraft((current) => ({
      ...current,
      resourceCategories: current.resourceCategories.includes(category)
        ? current.resourceCategories.filter((item) => item !== category)
        : [...current.resourceCategories, category],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.isDiscoverable && draft.resourceCategories.length === 0) {
      setNotice("Choose at least one resource category to appear in discovery.");
      return;
    }
    setSaving(true);
    const saved = await onSave(draft);
    setSaving(false);
    setNotice(
      saved ? "Your sharing preferences are saved." : "Could not save preferences.",
    );
  }

  return (
    <form className={styles.profileEditor} onSubmit={submit}>
      <div>
        <p className={styles.eyebrow}>Your availability</p>
        <h3>Choose what other students can discover</h3>
        <p>
          Opt in only if you are comfortable receiving resource requests. Your email,
          phone and home address are never shown here.
        </p>
      </div>
      <label className={styles.profileOptIn}>
        <input
          checked={draft.isDiscoverable}
          onChange={(event) =>
            setDraft({ ...draft, isDiscoverable: event.target.checked })
          }
          type="checkbox"
        />
        Show my resource profile to other students
      </label>
      <fieldset>
        <legend>Resources I may share</legend>
        <div className={styles.profileCategories}>
          {resourceCategories.map((category) => (
            <label key={category.id}>
              <input
                checked={draft.resourceCategories.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
                type="checkbox"
              />
              {category.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.profileFields}>
        <label>
          Level
          <input
            maxLength={60}
            onChange={(event) => setDraft({ ...draft, level: event.target.value })}
            value={draft.level}
          />
        </label>
        <label>
          Hall or meeting area
          <input
            maxLength={100}
            onChange={(event) => setDraft({ ...draft, hall: event.target.value })}
            value={draft.hall}
          />
        </label>
        <label>
          Availability note
          <input
            maxLength={500}
            onChange={(event) =>
              setDraft({ ...draft, availabilityNote: event.target.value })
            }
            value={draft.availabilityNote}
          />
        </label>
      </div>
      <div className={styles.profileFooter}>
        <button disabled={saving} type="submit">
          {saving ? "Saving…" : "Save preferences"}
        </button>
        <span role="status">{notice}</span>
      </div>
    </form>
  );
}
