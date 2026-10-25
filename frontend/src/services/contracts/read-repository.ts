import type { EntityId } from "@/types/common";

export interface ReadRepository<TEntity> {
  list(): Promise<readonly TEntity[]>;
  getById(id: EntityId): Promise<TEntity | null>;
}
