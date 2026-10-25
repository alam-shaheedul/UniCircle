import type { SessionUser } from "@/features/auth/types/session-user";

export interface SessionService {
  getCurrentUser(): Promise<SessionUser | null>;
  logout(): Promise<void>;
}
