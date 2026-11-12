import type { MigrationObject } from '@mikro-orm/core';
import { Migration20261111000000TenancyWorkloads } from './Migration20261111000000_tenancy_workloads.js';

/** Ordered, explicit migration list. Migrations are reviewed SQL; never edit an applied one. */
export const MIGRATIONS: MigrationObject[] = [
  {
    name: 'Migration20261111000000_tenancy_workloads',
    class: Migration20261111000000TenancyWorkloads,
  },
];
