"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/ui/feedback/empty-state";
import { routes } from "@/config/routes";
import { ResourceRequestModal } from "@/features/resources/components/resource-request-modal";
import { ResourceProfileEditor } from "@/features/resources/components/resource-profile-editor";
import { useResourceSharing } from "@/features/resources/context/resource-sharing-context";
import { formatResourceDate } from "@/features/resources/lib/format-resource-time";
import {
  resourceCategories,
  type ResourceCategory,
  type ResourceConversation,
  type ResourcePerson,
  type ResourceRequest,
} from "@/features/resources/types/resource-sharing";

import styles from "./resource-sharing.module.css";

type ResourceView = "discover" | "requests";

const categoryLabels = new Map<ResourceCategory, string>(
  resourceCategories.map((category) => [category.id, category.label]),
);

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ResourceHubPage() {
  const {
    currentUserId,
    profile,
    people,
    requests,
    conversations,
    submitRequest,
    updateRequestStatus,
    saveProfile,
    error,
  } = useResourceSharing();
  const [view, setView] = useState<ResourceView>("discover");
  const [selectedPerson, setSelectedPerson] = useState<ResourcePerson | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ResourceCategory | "all">("all");

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const outgoingRequests = useMemo(
    () => requests.filter((request) => request.senderId === currentUserId),
    [currentUserId, requests],
  );
  const incomingRequests = useMemo(
    () => requests.filter((request) => request.receiverId === currentUserId),
    [currentUserId, requests],
  );
  const latestOutgoingByPerson = useMemo(() => {
    const requestMap = new Map<string, ResourceRequest>();

    for (const request of outgoingRequests) {
      if (!requestMap.has(request.receiverId)) {
        requestMap.set(request.receiverId, request);
      }
    }

    return requestMap;
  }, [outgoingRequests]);
  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return people.filter((person) => {
      const matchesCategory =
        category === "all" || person.resourceCategories.includes(category);
      const matchesQuery =
        !normalizedQuery ||
        [person.name, person.department, person.hall, person.username].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );

      return matchesCategory && matchesQuery;
    });
  }, [category, people, query]);
  const pendingIncomingCount = incomingRequests.filter(
    (request) => request.status === "pending",
  ).length;

  function findConversation(requestId: string) {
    return conversations.find((conversation) => conversation.requestId === requestId);
  }

  return (
    <AppShell className={styles.pageShell}>
      <section className={styles.hero} aria-labelledby="resource-title">
        <div>
          <p className={styles.eyebrow}>CUET peer exchange</p>
          <h1 id="resource-title">
            Ask your campus. <span>Share what helps.</span>
          </h1>
          <p>
            Find trusted students, request everyday academic or physical resources, and
            coordinate safely after they accept.
          </p>
        </div>
        <div className={styles.heroSummary}>
          <span>Community snapshot</span>
          <strong>{people.length}</strong>
          <p>students in this discovery view</p>
          <div>
            <span>{pendingIncomingCount} waiting for you</span>
            <span>{conversations.length} open chats</span>
          </div>
        </div>
      </section>

      {error ? (
        <p className={styles.resourceError} role="alert">
          {error}
        </p>
      ) : null}

      <nav className={styles.sectionNavigation} aria-label="Resource sharing sections">
        <button
          aria-pressed={view === "discover"}
          onClick={() => setView("discover")}
          type="button"
        >
          <span>01</span>
          <strong>Discover people</strong>
          <small>Browse resources and send a request</small>
        </button>
        <button
          aria-pressed={view === "requests"}
          onClick={() => setView("requests")}
          type="button"
        >
          <span>02</span>
          <strong>Request centre</strong>
          <small>Review sent and received requests</small>
          {pendingIncomingCount > 0 ? <b>{pendingIncomingCount}</b> : null}
        </button>
        <Link href={routes.chat}>
          <span>03</span>
          <strong>Coordination chat</strong>
          <small>Available after a request is accepted</small>
          <b aria-hidden="true">↗</b>
        </Link>
      </nav>

      {view === "discover" ? (
        <section className={styles.discoverySection} aria-labelledby="discover-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>People you may know</p>
              <h2 id="discover-title">Find someone who can help</h2>
            </div>
            <p>
              Resource availability is self-reported. Agree on clear collection and
              return details after acceptance.
            </p>
          </div>

          <ResourceProfileEditor profile={profile} onSave={saveProfile} />

          <div className={styles.discoveryFilters}>
            <label>
              <span>Search people</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, department, username, or hall"
                type="search"
                value={query}
              />
            </label>
            <label>
              <span>Resource category</span>
              <select
                onChange={(event) =>
                  setCategory(event.target.value as ResourceCategory | "all")
                }
                value={category}
              >
                <option value="all">All resources</option>
                {resourceCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredPeople.length === 0 ? (
            <EmptyState
              title="No matching students"
              description="No students have opted in yet, or no one matches your filters. You can set your own sharing preferences above."
            />
          ) : (
            <div className={styles.peopleGrid}>
              {filteredPeople.map((person) => (
                <PersonCard
                  key={person.id}
                  latestRequest={latestOutgoingByPerson.get(person.id)}
                  onRequest={() => setSelectedPerson(person)}
                  person={person}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className={styles.requestCentre} aria-labelledby="requests-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Request centre</p>
              <h2 id="requests-title">Keep every exchange clear</h2>
            </div>
            <p>
              Accept only requests you can fulfil. A private coordination chat opens
              after acceptance.
            </p>
          </div>

          <div className={styles.requestColumns}>
            <RequestList
              currentUserId={currentUserId}
              emptyDescription="New requests from other students will appear here."
              emptyTitle="No received requests"
              findConversation={findConversation}
              onStatusChange={updateRequestStatus}
              peopleById={peopleById}
              requests={incomingRequests}
              title="Received requests"
            />
            <RequestList
              currentUserId={currentUserId}
              emptyDescription="Requests you send from the discovery page will appear here."
              emptyTitle="No sent requests"
              findConversation={findConversation}
              peopleById={peopleById}
              requests={outgoingRequests}
              title="Sent requests"
            />
          </div>
        </section>
      )}

      {selectedPerson ? (
        <ResourceRequestModal
          error={error}
          onClose={() => setSelectedPerson(null)}
          onSubmit={async (request) => {
            if (await submitRequest(request)) {
              setSelectedPerson(null);
              setView("requests");
            }
          }}
          person={selectedPerson}
        />
      ) : null}
    </AppShell>
  );
}

type PersonCardProps = Readonly<{
  person: ResourcePerson;
  latestRequest: ResourceRequest | undefined;
  onRequest: () => void;
}>;

function PersonCard({ person, latestRequest, onRequest }: PersonCardProps) {
  return (
    <article className={styles.personCard}>
      <header>
        <span aria-hidden="true">{getInitials(person.name)}</span>
        <div>
          <p>@{person.username}</p>
          <h3>{person.name}</h3>
          <small>
            {person.department}
            {person.level ? ` · ${person.level}` : ""}
          </small>
        </div>
      </header>
      <p className={styles.availability}>{person.availabilityNote}</p>
      <ul className={styles.resourceTags} aria-label="Resources they may share">
        {person.resourceCategories.map((category) => (
          <li key={category}>{categoryLabels.get(category)}</li>
        ))}
      </ul>
      <div className={styles.personMeta}>
        <span>{person.hall}</span>
      </div>
      <footer>
        {latestRequest?.status === "accepted" ? (
          <Link href={routes.chat}>Open coordination chat</Link>
        ) : null}
        <button
          disabled={latestRequest?.status === "pending"}
          onClick={onRequest}
          type="button"
        >
          {latestRequest?.status === "pending"
            ? "Request pending"
            : latestRequest?.status === "accepted"
              ? "Request another resource"
              : latestRequest?.status === "rejected"
                ? "Request again"
                : "Request a resource"}
        </button>
        {latestRequest ? (
          <span className={styles.statusBadge} data-status={latestRequest.status}>
            {latestRequest.status}
          </span>
        ) : (
          <span>Chat unlocks after acceptance</span>
        )}
      </footer>
    </article>
  );
}

type RequestListProps = Readonly<{
  title: string;
  requests: readonly ResourceRequest[];
  peopleById: ReadonlyMap<string, ResourcePerson>;
  currentUserId: string;
  emptyTitle: string;
  emptyDescription: string;
  findConversation: (requestId: string) => ResourceConversation | undefined;
  onStatusChange?: (requestId: string, status: "accepted" | "rejected") => void;
}>;

function RequestList({
  title,
  requests,
  peopleById,
  currentUserId,
  emptyTitle,
  emptyDescription,
  findConversation,
  onStatusChange,
}: RequestListProps) {
  return (
    <section className={styles.requestList}>
      <header>
        <h3>{title}</h3>
        <span>{requests.length}</span>
      </header>
      {requests.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div>
          {requests.map((request) => {
            const otherUserId =
              request.senderId === currentUserId
                ? request.receiverId
                : request.senderId;
            const person = peopleById.get(otherUserId);
            const conversation = findConversation(request.id);

            return (
              <article className={styles.requestCard} key={request.id}>
                <div className={styles.requestTopline}>
                  <span className={styles.statusBadge} data-status={request.status}>
                    {request.status}
                  </span>
                  <time dateTime={request.createdAt}>
                    {formatResourceDate(request.createdAt)}
                  </time>
                </div>
                <p>{person?.name ?? "CUET student"}</p>
                <h4>{request.resourceName}</h4>
                <span>{categoryLabels.get(request.category)}</span>
                <blockquote>{request.message}</blockquote>

                {request.status === "pending" && onStatusChange ? (
                  <div className={styles.requestActions}>
                    <button
                      onClick={() => onStatusChange(request.id, "rejected")}
                      type="button"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onStatusChange(request.id, "accepted")}
                      type="button"
                    >
                      Accept request
                    </button>
                  </div>
                ) : request.status === "accepted" && conversation ? (
                  <Link className={styles.chatLink} href={routes.chat}>
                    Open coordination chat <span aria-hidden="true">→</span>
                  </Link>
                ) : request.status === "pending" ? (
                  <p className={styles.lockedNote}>Waiting for the other student</p>
                ) : (
                  <p className={styles.lockedNote}>Chat is not available</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
