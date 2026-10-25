"use client";

import { useState } from "react";

import type { AdminSnapshotSetter } from "@/features/admin/components/admin-page";
import type {
  AdminCommunityReport,
  AdminSnapshot,
  ReportStatus,
} from "@/features/admin/types/admin";
import { adminService } from "@/services";

import styles from "./admin-page.module.css";

const reportTimeFormatter = new Intl.DateTimeFormat("en-BD", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function AdminReportManager({
  snapshot,
  setSnapshot,
}: Readonly<{ snapshot: AdminSnapshot; setSnapshot: AdminSnapshotSetter }>) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const openCount = snapshot.reports.filter(
    (report) => report.status === "open",
  ).length;

  async function updateReport(report: AdminCommunityReport, status: ReportStatus) {
    setBusyId(report.id);
    setError("");
    try {
      const saved = await adminService.setReportStatus(report, status);
      setSnapshot((current) => ({
        ...current,
        reports: current.reports.map((item) => {
          if (item.id === saved.id) return saved;
          if (status === "post-removed" && item.postId === saved.postId) {
            return { ...item, status: "post-removed" };
          }
          return item;
        }),
      }));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The report could not be updated.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className={styles.managerSection} aria-labelledby="reports-title">
      <header className={styles.sectionHeading}>
        <div>
          <p>Community safeguards</p>
          <h2 id="reports-title">Reported-post queue</h2>
        </div>
        <span>{openCount} awaiting review</span>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {snapshot.reports.length === 0 ? (
        <div className={styles.adminEmptyState}>
          <h3>No reported posts</h3>
          <p>New community reports will appear here for Admin review.</p>
        </div>
      ) : (
        <div className={styles.reportList}>
          {snapshot.reports.map((report) => (
            <article data-status={report.status} key={report.id}>
              <div className={styles.reportHeader}>
                <div>
                  <span>{report.status.replace("-", " ")}</span>
                  <strong>{report.reason}</strong>
                </div>
                <time dateTime={report.reportedAt}>
                  {reportTimeFormatter.format(new Date(report.reportedAt))}
                </time>
              </div>

              <blockquote>{report.postBody}</blockquote>

              <dl>
                <div>
                  <dt>Post author</dt>
                  <dd>{report.authorName}</dd>
                </div>
                <div>
                  <dt>Reported by</dt>
                  <dd>{report.reportedBy}</dd>
                </div>
                <div>
                  <dt>Post reference</dt>
                  <dd>{report.postId}</dd>
                </div>
              </dl>

              {report.status === "open" ? (
                <div className={styles.moderationActions}>
                  <button
                    disabled={busyId === report.id}
                    onClick={() => void updateReport(report, "resolved")}
                    type="button"
                  >
                    Dismiss and resolve
                  </button>
                  <button
                    disabled={busyId === report.id}
                    onClick={() => void updateReport(report, "post-removed")}
                    type="button"
                  >
                    Remove reported post
                  </button>
                </div>
              ) : (
                <p className={styles.resolutionNote}>
                  {report.status === "resolved"
                    ? "Report resolved; the post remains visible."
                    : "Reported post removed from the community feed."}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
