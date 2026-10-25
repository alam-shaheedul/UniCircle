"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { AssistantMessage } from "@/features/assistant/components/assistant-message";
import {
  assistantSuggestions,
  assistantWelcomeMessage,
} from "@/features/assistant/content/assistant-content";
import type { CampusAssistantMessage } from "@/features/assistant/types/campus-assistant";
import { campusAssistantService } from "@/services";

import styles from "./campus-assistant-page.module.css";

const maximumQuestionLength = 500;

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CampusAssistantPage() {
  const [messages, setMessages] = useState<CampusAssistantMessage[]>([
    assistantWelcomeMessage,
  ]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);

  useEffect(() => {
    if (shouldScrollRef.current) {
      conversationEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      shouldScrollRef.current = false;
    }
  }, [error, isThinking, messages]);

  async function requestAnswer(question: string, addUserMessage: boolean) {
    if (isThinking) return;

    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;

    if (addUserMessage) {
      shouldScrollRef.current = true;
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId("user"),
          role: "user",
          content: cleanQuestion,
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    setDraft("");
    setError("");
    setLastQuestion(cleanQuestion);
    setIsThinking(true);

    try {
      const reply = await campusAssistantService.ask(cleanQuestion);

      shouldScrollRef.current = true;
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: reply.answer,
          createdAt: new Date().toISOString(),
          status: reply.status,
        },
      ]);
    } catch (caughtError) {
      shouldScrollRef.current = true;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The campus assistant could not complete this request.",
      );
    } finally {
      setIsThinking(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestAnswer(draft, true);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function resetConversation() {
    setMessages([assistantWelcomeMessage]);
    setDraft("");
    setError("");
    setLastQuestion("");
  }

  return (
    <AppShell className={styles.pageShell}>
      <section className={styles.hero} aria-labelledby="assistant-title">
        <div className={styles.heroCopy}>
          <p>CUET knowledge companion</p>
          <h1 id="assistant-title">
            Ask about campus. <span>Find the next step.</span>
          </h1>
          <p>
            Explore CUET information through a focused assistant designed for clear,
            grounded campus answers.
          </p>
          <div className={styles.prototypeNote}>
            <span aria-hidden="true">i</span>
            Answers use indexed official CUET information. Confirm important decisions
            with the appropriate university office.
          </div>
        </div>

        <aside className={styles.heroStatus} aria-label="Assistant service status">
          <div className={styles.orbitMark} aria-hidden="true">
            <span />
          </div>
          <div>
            <span>Assistant status</span>
            <strong>Ready to help</strong>
            <p>Live retrieval from indexed CUET information.</p>
          </div>
          <dl>
            <div>
              <dt>Topics</dt>
              <dd>CUET</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>Live RAG</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className={styles.assistantLayout} aria-label="Campus AI Assistant chat">
        <aside className={styles.guidePanel}>
          <div>
            <p>Conversation guide</p>
            <h2>Start with a campus topic</h2>
            <span>Choose a prompt or write your own CUET-related question.</span>
          </div>

          <div className={styles.suggestions}>
            {assistantSuggestions.map((suggestion, index) => (
              <button
                disabled={isThinking}
                key={suggestion.id}
                onClick={() => void requestAnswer(suggestion.question, true)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{suggestion.label}</strong>
                <small>{suggestion.question}</small>
              </button>
            ))}
          </div>
        </aside>

        <div className={styles.chatPanel}>
          <header className={styles.chatHeader}>
            <div>
              <span className={styles.onlineDot} aria-hidden="true" />
              <div>
                <strong>Campus AI Assistant</strong>
                <p>Grounded CUET campus answers</p>
              </div>
            </div>
            <button
              disabled={messages.length === 1 && !error}
              onClick={resetConversation}
              type="button"
            >
              Reset chat
            </button>
          </header>

          <ol className={styles.messageList} aria-live="polite" aria-busy={isThinking}>
            {messages.map((message) => (
              <AssistantMessage key={message.id} message={message} />
            ))}

            {isThinking ? (
              <li className={styles.thinkingRow} role="status">
                <span className={styles.avatar} aria-hidden="true">
                  AI
                </span>
                <div>
                  <strong>Checking campus information</strong>
                  <span className={styles.thinkingDots} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </li>
            ) : null}
          </ol>

          {error ? (
            <div className={styles.errorState} role="alert">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Assistant service unavailable</strong>
                <p>{error} Your conversation is safe; retry when you are ready.</p>
              </div>
              <button
                onClick={() => void requestAnswer(lastQuestion, false)}
                type="button"
              >
                Retry
              </button>
              <button
                aria-label="Dismiss error"
                onClick={() => setError("")}
                type="button"
              >
                Close
              </button>
            </div>
          ) : null}

          <form className={styles.composer} onSubmit={handleSubmit}>
            <label htmlFor="campus-question">Ask a campus question</label>
            <div>
              <textarea
                id="campus-question"
                maxLength={maximumQuestionLength}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                placeholder="For example: When is the evening bus from CUET?"
                rows={3}
                value={draft}
              />
              <button disabled={!draft.trim() || isThinking} type="submit">
                <span>{isThinking ? "Thinking" : "Ask assistant"}</span>
                <b aria-hidden="true">&#8593;</b>
              </button>
            </div>
            <p>
              <span>
                {draft.length}/{maximumQuestionLength}
              </span>
              Press Enter to send - Shift + Enter for a new line
            </p>
          </form>
          <div ref={conversationEndRef} />
        </div>
      </section>
    </AppShell>
  );
}
