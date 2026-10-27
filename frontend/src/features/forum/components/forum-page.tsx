"use client";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/ui/feedback/empty-state";
import { ForumPostCard } from "@/features/forum/components/forum-post-card";
import { PostComposer } from "@/features/forum/components/post-composer";
import type {
  ForumComment,
  ForumPost,
  ForumSnapshot,
} from "@/features/forum/types/forum";
import { forumService } from "@/services";

import styles from "./forum-page.module.css";

type ForumPageProps = Readonly<{
  initialSnapshot: ForumSnapshot;
}>;

export function ForumPage({ initialSnapshot }: ForumPageProps) {
  const [posts, setPosts] = useState<ForumPost[]>([...initialSnapshot.posts]);
  const [reportedPostIds, setReportedPostIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        initialSnapshot.posts
          .filter((post) => post.isReportedByCurrentUser)
          .map((post) => post.id),
      ),
  );
  const [announcement, setAnnouncement] = useState("");

  const totalComments = useMemo(
    () => posts.reduce((total, post) => total + post.comments.length, 0),
    [posts],
  );

  async function createPost(body: string) {
    const created = await forumService.createPost(body);
    setPosts((current) => [created, ...current]);
    setAnnouncement("Your discussion was published at the top of the community feed.");
  }

  async function createComment(postId: string, body: string) {
    const comment: ForumComment = await forumService.createComment(postId, body);

    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? { ...post, comments: [...post.comments, comment] } : post,
      ),
    );
    setAnnouncement("Your comment was added to the discussion.");
  }

  async function reportPost(postId: string) {
    await forumService.reportPost(
      postId,
      "Community standards review requested by a forum user.",
    );
    setReportedPostIds((current) => new Set(current).add(postId));
    setAnnouncement("The post was reported to an App Admin for review.");
  }

  return (
    <AppShell className={styles.pageShell}>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <section className={styles.hero} aria-labelledby="forum-title">
        <div className={styles.heroCopy}>
          <p>CUET community forum</p>
          <h1 id="forum-title">
            Ask openly. <span>Build solutions together.</span>
          </h1>
          <p>
            Share campus concerns, request help, and hold constructive discussions with
            students, teachers, and staff across CUET.
          </p>
          <div className={styles.heroNote}>
            <span aria-hidden="true">Aa</span>
            Text-only discussions · no reactions or media posts
          </div>
        </div>

        <aside className={styles.heroStats} aria-label="Forum summary">
          <div>
            <strong>{String(posts.length).padStart(2, "0")}</strong>
            <span>community discussions</span>
          </div>
          <div>
            <strong>{String(totalComments).padStart(2, "0")}</strong>
            <span>helpful comments</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>reporting available</span>
          </div>
        </aside>
      </section>

      <PostComposer
        currentUser={initialSnapshot.currentUser}
        onCreatePost={createPost}
      />

      <div className={styles.forumLayout}>
        <section className={styles.feedSection} aria-labelledby="community-feed-title">
          <header className={styles.sectionHeading}>
            <div>
              <p>Newest first</p>
              <h2 id="community-feed-title">Community feed</h2>
            </div>
            <span>
              {posts.length} active discussion{posts.length === 1 ? "" : "s"}
            </span>
          </header>

          {posts.length === 0 ? (
            <EmptyState
              title="No community posts yet"
              description="Create the first text discussion for the CUET community."
            />
          ) : (
            <div className={styles.feedList}>
              {posts.map((post) => (
                <ForumPostCard
                  isReported={reportedPostIds.has(post.id)}
                  key={post.id}
                  onCreateComment={createComment}
                  onReportPost={reportPost}
                  post={post}
                />
              ))}
            </div>
          )}
        </section>

        <aside className={styles.communitySidebar} aria-label="Community guidance">
          <section>
            <p>Community standards</p>
            <h2>Make every discussion useful.</h2>
            <ol>
              <li>
                <span>01</span>
                Describe the campus issue or question clearly.
              </li>
              <li>
                <span>02</span>
                Comment with relevant information and respect.
              </li>
              <li>
                <span>03</span>
                Report inappropriate posts for Admin review.
              </li>
            </ol>
          </section>
          <section className={styles.moderationNote}>
            <span aria-hidden="true">!</span>
            <div>
              <strong>How reporting works</strong>
              <p>
                Reports are reviewed by an App Admin. General users cannot remove or
                moderate posts.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
