import type {
  CampusAssistantMessage,
  CampusAssistantSuggestion,
} from "@/features/assistant/types/campus-assistant";

export const assistantWelcomeMessage: CampusAssistantMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "Welcome! I am the UniCircle Campus AI Assistant. Ask me about CUET campus information.",
  createdAt: "2026-09-26T18:00:00+06:00",
  status: "welcome",
};

export const assistantSuggestions = [
  {
    id: "academics",
    label: "Academic departments",
    question: "What academic departments does CUET have?",
  },
  {
    id: "directory",
    label: "CSE faculty",
    question: "Where can I find information about CSE faculty members?",
  },
  {
    id: "campus",
    label: "About CUET",
    question: "Where is CUET located and what is its history?",
  },
  {
    id: "notices",
    label: "Campus information",
    question: "What official information is available for CUET students?",
  },
] as const satisfies readonly CampusAssistantSuggestion[];
