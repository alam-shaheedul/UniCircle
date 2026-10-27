import type { EntityId, UserRole } from "@/types/common";

export type ForumAuthor = Readonly<{
  id: EntityId;
  displayName: string;
  username: string;
  role: Exclude<UserRole, "admin">;
  academicUnit: string;
}>;

export type ForumComment = Readonly<{
  id: EntityId;
  postId: EntityId;
  author: ForumAuthor;
  body: string;
  createdAt: string;
}>;

export type ForumPost = Readonly<{
  id: EntityId;
  author: ForumAuthor;
  body: string;
  createdAt: string;
  comments: readonly ForumComment[];
  isReportedByCurrentUser?: boolean;
}>;

export type ForumSnapshot = Readonly<{
  currentUser: ForumAuthor;
  posts: readonly ForumPost[];
}>;
