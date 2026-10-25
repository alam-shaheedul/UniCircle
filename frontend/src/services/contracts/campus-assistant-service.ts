import type { CampusAssistantReply } from "@/features/assistant/types/campus-assistant";

export interface CampusAssistantService {
  ask(question: string): Promise<CampusAssistantReply>;
}
