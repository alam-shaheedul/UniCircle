"use client";

import { useId, useState, type FormEvent } from "react";

import { FormError } from "@/components/ui/forms/form-error";
import type { ForumAuthor } from "@/features/forum/types/forum";

import styles from "./forum-page.module.css";

type PostComposerProps = Readonly<{
  currentUser: ForumAuthor;
  onCreatePost: (body: string) => Promise<void>;
}>;

const maximumPostLength = 1200;

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PostComposer({ currentUser, onCreatePost }: PostComposerProps) {
  const textareaId = useId();
  const hintId = useId();
  const errorId = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedBody = body.trim();

    if (!normalizedBody) {
      setError("Write something before publishing your post.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onCreatePost(normalizedBody);
      setBody("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Your discussion could not be published.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.composerCard} aria-labelledby="create-post-title">
      <header>
        <span className={styles.avatar} data-role={currentUser.role} aria-hidden="true">
          {getInitials(currentUser.displayName)}
        </span>
        <div>
          <p>Posting as {currentUser.displayName}</p>
          <h2 id="create-post-title">Start a community discussion</h2>
        </div>
        <span className={styles.textOnlyBadge}>Text only</span>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <label className="visually-hidden" htmlFor={textareaId}>
          Post text
        </label>
        <textarea
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={Boolean(error)}
          disabled={isSubmitting}
          id={textareaId}
          maxLength={maximumPostLength}
          onChange={(event) => {
            setBody(event.target.value);
            if (error && event.target.value.trim()) setError(null);
          }}
          placeholder="Share a campus question, community problem, help request, or discussion…"
          rows={5}
          value={body}
        />
        <FormError id={errorId} message={error} />
        <footer>
          <p id={hintId}>
            Community posts support text only. Keep the conversation useful and
            respectful.
          </p>
          <div>
            <span>
              {body.length}/{maximumPostLength}
            </span>
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Publishing…" : "Publish post"}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
