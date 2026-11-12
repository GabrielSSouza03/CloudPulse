import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql';
import { Workload, type WorkloadKind } from '../domain/workload.js';

export type WorkloadPageQuery = {
  limit: number;
  afterId?: string;
  teamId?: string;
  kind?: WorkloadKind;
};

export class WorkloadRepository {
  constructor(private readonly em: EntityManager) {}

  add(workload: Workload): void {
    this.em.persist(workload);
  }

  /** Keyset page ordered by UUIDv7 id (creation order). Fetches one extra row to detect a next page. */
  async page(query: WorkloadPageQuery): Promise<{ items: Workload[]; hasMore: boolean }> {
    const where: FilterQuery<Workload> = {};
    if (query.afterId) where.id = { $gt: query.afterId };
    if (query.teamId) where.teamId = query.teamId;
    if (query.kind) where.kind = query.kind;
    const rows = await this.em.find(Workload, where, {
      orderBy: { id: 'asc' },
      limit: query.limit + 1,
    });
    return { items: rows.slice(0, query.limit), hasMore: rows.length > query.limit };
  }
}
