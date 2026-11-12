import { Inject, Injectable } from '@nestjs/common';
import {
  ForeignKeyConstraintViolationException,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import { TenantTransactions } from '../../../platform/database/tenant-transactions.js';
import { CLOCK, type Clock } from '../../../shared-kernel/clock.js';
import { ConflictError, UnprocessableError } from '../../../shared-kernel/errors.js';
import { newId } from '../../../shared-kernel/ids.js';
import { type Actor, authorize } from '../../tenancy/index.js';
import { Workload, type WorkloadKind, type WorkloadTags } from '../domain/workload.js';
import { WorkloadRepository } from '../infrastructure/workload.repository.js';

export type WorkloadView = {
  id: string;
  key: string;
  name: string;
  kind: WorkloadKind;
  teamId: string;
  tags: WorkloadTags;
  createdAt: string;
};

export type RegisterWorkloadInput = {
  key: string;
  name: string;
  kind: WorkloadKind;
  teamId: string;
  tags?: WorkloadTags;
};

const toView = (w: Workload): WorkloadView => ({
  id: w.id,
  key: w.key,
  name: w.name,
  kind: w.kind,
  teamId: w.teamId,
  tags: w.tags,
  createdAt: w.createdAt.toISOString(),
});

@Injectable()
export class WorkloadService {
  constructor(
    private readonly tx: TenantTransactions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async register(actor: Actor, input: RegisterWorkloadInput): Promise<WorkloadView> {
    authorize(actor, 'workloads:write');
    const workload = new Workload({
      id: newId(),
      tenantId: actor.tenantId,
      createdAt: this.clock.now(),
      ...input,
    });
    try {
      await this.tx.run(actor.tenantId, async (em) => new WorkloadRepository(em).add(workload));
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictError(
          'workload_key_conflict',
          `Workload key "${workload.key}" is already registered.`,
        );
      }
      // The composite FK (tenant_id, team_id) also rejects a team id that belongs to another tenant.
      if (error instanceof ForeignKeyConstraintViolationException) {
        throw new UnprocessableError('team_not_found', 'The team does not exist in this tenant.');
      }
      throw error;
    }
    return toView(workload);
  }

  async page(
    actor: Actor,
    query: { limit: number; afterId?: string; teamId?: string; kind?: WorkloadKind },
  ): Promise<{ items: WorkloadView[]; hasMore: boolean }> {
    authorize(actor, 'workloads:read');
    const page = await this.tx.run(actor.tenantId, (em) => new WorkloadRepository(em).page(query));
    return { items: page.items.map(toView), hasMore: page.hasMore };
  }
}
