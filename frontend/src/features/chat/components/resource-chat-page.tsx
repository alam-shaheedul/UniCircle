"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/ui/feedback/empty-state";
import { routes } from "@/config/routes";
import { useResourceSharing } from "@/features/resources/context/resource-sharing-context";
import {
  formatMessageTime,
  formatResourceDate,
} from "@/features/resources/lib/format-resource-time";

import styles from "./resource-chat.module.css";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ResourceChatPage() {
  const {
    currentUserId,
    people,
    requests,
    conversations,
    messages,
    hasOlderMessages,
    loadMessages,
    sendMessage,
    error,
  } = useResourceSharing();
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const requestsById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests],
  );
  const selectedConversation =
    conversations.find((item) => item.id === selectedId) ?? conversations[0];
  const selectedPerson = selectedConversation
    ? peopleById.get(selectedConversation.otherUserId)
    : undefined;
  const selectedName =
    selectedPerson?.name ?? selectedConversation?.otherUserName ?? "CUET student";
  const selectedRequest = selectedConversation
    ? requestsById.get(selectedConversation.requestId)
    : undefined;
  const selectedMessages = selectedConversation
    ? messages.filter((item) => item.conversationId === selectedConversation.id)
    : [];
  const conversationId = selectedConversation?.id;

  useEffect(() => {
    if (!conversationId) return;
    void loadMessages(conversationId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages(conversationId);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [conversationId, loadMessages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!conversationId || !body || sending) return;
    setSending(true);
    if (await sendMessage(conversationId, body)) setDraft("");
    setSending(false);
  }

  return (
    <AppShell className={styles.pageShell}>
      <section className={styles.heading} aria-labelledby="chat-title">
        <div>
          <p>Accepted-request coordination</p>
          <h1 id="chat-title">Resource chat</h1>
          <span>
            Conversations appear here only after a resource request is accepted.
          </span>
        </div>
        <Link href={routes.resources}>← Resource sharing</Link>
      </section>
      {error ? (
        <p className={styles.chatError} role="alert">
          {error}
        </p>
      ) : null}
      {conversations.length === 0 ? (
        <EmptyState
          title="No open conversations"
          description="Browse students and send a resource request. Chat will unlock when the other student accepts it."
        />
      ) : (
        <div className={styles.chatLayout}>
          <aside className={styles.conversationPanel}>
            <header>
              <div>
                <p>Inbox</p>
                <h2>Conversations</h2>
              </div>
              <span>{conversations.length}</span>
            </header>
            <div className={styles.conversationList}>
              {conversations.map((conversation) => {
                const person = peopleById.get(conversation.otherUserId);
                const request = requestsById.get(conversation.requestId);
                const latestMessage = messages
                  .filter((item) => item.conversationId === conversation.id)
                  .at(-1);
                const name = person?.name ?? conversation.otherUserName;
                return (
                  <button
                    aria-pressed={conversation.id === selectedConversation?.id}
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    type="button"
                  >
                    <span aria-hidden="true">{initials(name)}</span>
                    <div>
                      <strong>{name}</strong>
                      <p>{request?.resourceName ?? conversation.resourceName}</p>
                      <small>{latestMessage?.body ?? "Conversation ready"}</small>
                    </div>
                    <time dateTime={conversation.lastActivityAt}>
                      {formatMessageTime(conversation.lastActivityAt)}
                    </time>
                  </button>
                );
              })}
            </div>
          </aside>
          {selectedConversation ? (
            <section className={styles.chatPanel} aria-label="Selected conversation">
              <header className={styles.chatHeader}>
                <span aria-hidden="true">{initials(selectedName)}</span>
                <div>
                  <h2>{selectedName}</h2>
                  <p>
                    {selectedPerson
                      ? `@${selectedPerson.username} · ${selectedPerson.department}`
                      : "CUET student"}
                  </p>
                </div>
                <div>
                  <span>Accepted request</span>
                  <strong>
                    {selectedRequest?.resourceName ?? selectedConversation.resourceName}
                  </strong>
                </div>
              </header>
              <div className={styles.messageList} aria-live="polite">
                {selectedRequest ? (
                  <div className={styles.requestContext}>
                    <span>Request accepted</span>
                    <strong>{selectedRequest.resourceName}</strong>
                    <p>{selectedRequest.message}</p>
                    <time dateTime={selectedRequest.createdAt}>
                      Requested {formatResourceDate(selectedRequest.createdAt)}
                    </time>
                  </div>
                ) : null}
                {hasOlderMessages[selectedConversation.id] && selectedMessages[0] ? (
                  <button
                    className={styles.loadOlder}
                    onClick={() =>
                      void loadMessages(selectedConversation.id, selectedMessages[0].id)
                    }
                    type="button"
                  >
                    Load older messages
                  </button>
                ) : null}
                {selectedMessages.map((message) => (
                  <article
                    className={styles.message}
                    data-current-user={message.senderId === currentUserId}
                    key={message.id}
                  >
                    <div>
                      <p>{message.body}</p>
                      <time dateTime={message.sentAt}>
                        {formatMessageTime(message.sentAt)}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
              <form className={styles.messageComposer} onSubmit={handleSubmit}>
                <label>
                  <span className="visually-hidden">Message {selectedName}</span>
                  <textarea
                    maxLength={4000}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={`Message ${selectedName}`}
                    rows={2}
                    value={draft}
                  />
                </label>
                <button disabled={!draft.trim() || sending} type="submit">
                  {sending ? "Sending…" : "Send message"}
                </button>
              </form>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
