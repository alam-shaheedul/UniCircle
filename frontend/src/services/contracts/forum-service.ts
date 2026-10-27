import type {
  ForumComment,
  ForumPost,
  ForumSnapshot,
} from "@/features/forum/types/forum";

export interface ForumService {
  getSnapshot(token?: string): Promise<ForumSnapshot>;
  createPost(body: string): Promise<ForumPost>;
  createComment(postId: string, body: string): Promise<ForumComment>;
  reportPost(postId: string, reason: string): Promise<void>;
}
