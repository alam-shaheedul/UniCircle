"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { AdminAnnouncementManager } from "@/features/admin/components/admin-announcement-manager";
import { AdminClubRequestManager } from "@/features/admin/components/admin-club-request-manager";
import { AdminReportManager } from "@/features/admin/components/admin-report-manager";
import { AdminTransportManager } from "@/features/admin/components/admin-transport-manager";
import type { AdminSectionId, AdminSnapshot } from "@/features/admin/types/admin";
import { useClubEvents } from "@/features/clubs-events/context/club-event-context";

import styles from "./admin-page.module.css";

export type AdminSnapshotSetter = Dispatch<SetStateAction<AdminSnapshot>>;

type AdminPageProps = Readonly<{
  initialSnapshot: AdminSnapshot;
}>;

const sections = [
  { id: "overview", label: "Overview", hint: "Workspace summary" },
  { id: "transport", label: "Transport", hint: "Schedules, routes & drivers" },
  {
    id: "announcements",
    label: "Announcements",
    hint: "Campus publishing",
  },
  {
    id: "club-requests",
    label: "Club requests",
    hint: "Review student proposals",
  },
  { id: "reports", label: "Reports", hint: "Community moderation" },
] as const satisfies readonly {
  id: AdminSectionId;
  label: string;
  hint: string;
}[];

export function AdminPage({ initialSnapshot }: AdminPageProps) {
  const { snapshot: clubSnapshot } = useClubEvents();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeSection, setActiveSection] = useState<AdminSectionId>("overview");

  const openReports = snapshot.reports.filter(
    (report) => report.status === "open",
  ).length;
  const publishedItems = snapshot.announcements.filter(
    (item) => item.status === "published",
  ).length;
  const pendingClubRequests = clubSnapshot.clubRequests.filter(
    (request) => request.status === "pending",
  ).length;

  return (
    <AppShell className={styles.pageShell}>
      <section className={styles.hero} aria-labelledby="admin-title">
        <div>
          <p>UniCircle administration</p>
          <h1 id="admin-title">
            Campus operations, <span>one controlled workspace.</span>
          </h1>
          <p>
            Maintain transport information, publish campus updates, review new club
            proposals, and moderate reported community discussions.
          </p>
        </div>
        <dl>
          <div>
            <dt>Schedules</dt>
            <dd>{String(snapshot.schedules.length).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Published</dt>
            <dd>{String(publishedItems).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Open reports</dt>
            <dd>{String(openReports).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Club requests</dt>
            <dd>{String(pendingClubRequests).padStart(2, "0")}</dd>
          </div>
        </dl>
      </section>

      <nav className={styles.adminNavigation} aria-label="Admin sections">
        {sections.map((section) => (
          <button
            aria-pressed={activeSection === section.id}
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            type="button"
          >
            <strong>{section.label}</strong>
            <span>{section.hint}</span>
          </button>
        ))}
      </nav>

      {activeSection === "overview" ? (
        <AdminOverview snapshot={snapshot} onSelectSection={setActiveSection} />
      ) : null}
      {activeSection === "transport" ? (
        <AdminTransportManager snapshot={snapshot} setSnapshot={setSnapshot} />
      ) : null}
      {activeSection === "announcements" ? (
        <AdminAnnouncementManager snapshot={snapshot} setSnapshot={setSnapshot} />
      ) : null}
      {activeSection === "reports" ? (
        <AdminReportManager snapshot={snapshot} setSnapshot={setSnapshot} />
      ) : null}
      {activeSection === "club-requests" ? <AdminClubRequestManager /> : null}
    </AppShell>
  );
}

function AdminOverview({
  snapshot,
  onSelectSection,
}: Readonly<{
  snapshot: AdminSnapshot;
  onSelectSection: (section: AdminSectionId) => void;
}>) {
  const { snapshot: clubSnapshot } = useClubEvents();
  const cards = [
    {
      id: "transport" as const,
      eyebrow: "Transport operations",
      title: `${snapshot.schedules.length} active schedule entries`,
      description: `${snapshot.routes.length} routes and ${snapshot.drivers.length} drivers are available for assignment.`,
      action: "Manage transport",
    },
    {
      id: "announcements" as const,
      eyebrow: "Publishing desk",
      title: `${snapshot.announcements.length} campus information items`,
      description: `${snapshot.announcements.filter((item) => item.status === "draft").length} draft items are waiting for review or publication.`,
      action: "Manage announcements",
    },
    {
      id: "club-requests" as const,
      eyebrow: "Club governance",
      title: `${clubSnapshot.clubRequests.filter((request) => request.status === "pending").length} club proposals awaiting review`,
      description:
        "Approve a student proposal to publish the club and assign its requester as the initial club admin.",
      action: "Review club requests",
    },
    {
      id: "reports" as const,
      eyebrow: "Community safety",
      title: `${snapshot.reports.filter((report) => report.status === "open").length} reports need review`,
      description:
        "Inspect the reported post context before resolving the report or removing the post.",
      action: "Open moderation queue",
    },
  ];

  return (
    <section className={styles.overviewSection} aria-labelledby="overview-title">
      <header className={styles.sectionHeading}>
        <div>
          <p>Today at a glance</p>
          <h2 id="overview-title">Admin dashboard</h2>
        </div>
        <span>Management overview</span>
      </header>
      <div className={styles.overviewGrid}>
        {cards.map((card, index) => (
          <article key={card.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{card.eyebrow}</p>
            <h3>{card.title}</h3>
            <div>{card.description}</div>
            <button onClick={() => onSelectSection(card.id)} type="button">
              {card.action}
            </button>
          </article>
        ))}
      </div>
      <div className={styles.scopeNote}>
        <strong>Approved Admin scope</strong>
        <p>
          This workspace contains transport, announcement, club-request approval, and
          community-moderation controls defined in the project workflow. Club event
          editing remains with mapped student club admins.
        </p>
      </div>
    </section>
  );
}
