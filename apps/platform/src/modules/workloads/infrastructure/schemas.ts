import { EntitySchema } from '@mikro-orm/core';
import { WORKLOAD_KINDS, Workload, type WorkloadKind } from '../domain/workload.js';

export const WorkloadSchema = new EntitySchema<Workload>({
  class: Workload,
  tableName: 'workload',
  properties: {
    id: { type: 'uuid', primary: true },
    tenantId: { type: 'uuid' },
    teamId: { type: 'uuid' },
    key: { type: 'string' },
    name: { type: 'string' },
    kind: { type: 'string', enum: true, items: (): WorkloadKind[] => [...WORKLOAD_KINDS] },
    tags: { type: 'json', columnType: 'jsonb' },
    createdAt: { type: 'datetime', columnType: 'timestamptz' },
  },
});

export const WORKLOADS_SCHEMAS = [WorkloadSchema];
