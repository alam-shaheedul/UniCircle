export type CampusAssistantMessageRole = "user" | "assistant";

export type CampusAssistantAnswerStatus = "answered" | "not-found";

export type CampusAssistantReply = Readonly<{
  answer: string;
  status: CampusAssistantAnswerStatus;
}>;

export type CampusAssistantMessage = Readonly<{
  id: string;
  role: CampusAssistantMessageRole;
  content: string;
  createdAt: string;
  status?: CampusAssistantAnswerStatus | "welcome";
}>;

export type CampusAssistantSuggestion = Readonly<{
  id: string;
  label: string;
  question: string;
}>;
