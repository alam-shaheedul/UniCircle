import { formatMessageTime } from "@/features/assistant/lib/format-message-time";
import type { CampusAssistantMessage } from "@/features/assistant/types/campus-assistant";

import styles from "./campus-assistant-page.module.css";

type AssistantMessageProps = Readonly<{
  message: CampusAssistantMessage;
}>;

function ResponseText({ children }: Readonly<{ children: string }>) {
  return children.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>);
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <li className={styles.messageRow} data-role={message.role}>
      <span className={styles.avatar} aria-hidden="true">
        {isAssistant ? "AI" : "You"}
      </span>
      <article
        className={styles.messageBubble}
        data-status={message.status}
        aria-label={`${isAssistant ? "Campus assistant" : "Your"} message`}
      >
        <div className={styles.messageMeta}>
          <strong>{isAssistant ? "Campus Assistant" : "You"}</strong>
          {message.status === "not-found" ? <span>Not found</span> : null}
          <time dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
        <div className={styles.responseText}>
          <ResponseText>{message.content}</ResponseText>
        </div>
      </article>
    </li>
  );
}
