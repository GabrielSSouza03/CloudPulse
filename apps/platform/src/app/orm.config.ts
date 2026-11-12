import { defineConfig, type Options } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { MIGRATIONS } from '../migrations/index.js';
import { TENANCY_SCHEMAS } from '../modules/tenancy/index.js';
import { WORKLOADS_SCHEMAS } from '../modules/workloads/index.js';
import { TENANT_FILTER } from '../platform/database/tenant-transactions.js';

export const ENTITY_SCHEMAS = [...TENANCY_SCHEMAS, ...WORKLOADS_SCHEMAS];

const TENANT_OWNED = ENTITY_SCHEMAS.filter((s) => 'tenantId' in s.meta.properties).map(
  (s) => s.meta.className,
);

export function ormConfig(options: { url: string; poolMax?: number; debug?: boolean }): Options {
  return defineConfig({
    clientUrl: options.url,
    entities: ENTITY_SCHEMAS,
    pool: { min: 0, max: options.poolMax ?? 10 },
    debug: options.debug ?? false,
    extensions: [Migrator],
    migrations: {
      tableName: 'schema_migrations',
      migrationsList: MIGRATIONS,
      transactional: true,
      allOrNothing: true,
      snapshot: false,
    },
    filters: {
      // Application-level tenant scoping. RLS enforces the same rule in the database for the api
      // role; this filter also covers the worker role (BYPASSRLS). It fails closed without params.
      [TENANT_FILTER]: {
        cond: (args: { tenantId?: string }) => {
          if (!args.tenantId) throw new Error('tenant filter enabled without a tenantId');
          return { tenantId: args.tenantId };
        },
        entity: TENANT_OWNED,
        default: true,
        args: true,
      },
    },
  });
}
