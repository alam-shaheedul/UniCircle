import type { EntityId, UserRole } from "@/types/common";

export type GeneralSessionUser = Readonly<{
  id: EntityId;
  firstName: string;
  lastName: string;
  displayName: string;
  username: string;
  email: string;
  role: Exclude<UserRole, "admin">;
  universityId: string;
  department: string;
  phone: string;
  homeAddress: string;
  bio: string;
  memberSince: string;
}>;

export type AdminSessionUser = Readonly<{
  id: EntityId;
  role: "admin";
  adminId: string;
  displayName: string;
  memberSince: string;
}>;

export type SessionUser = GeneralSessionUser | AdminSessionUser;
