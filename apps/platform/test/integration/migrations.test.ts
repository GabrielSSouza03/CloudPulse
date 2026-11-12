import type { MikroORM } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { connect } from './support/db.js';

describe('migrations', () => {
  let migrator: MikroORM;

  beforeAll(async () => {
    migrator = await connect(inject('databaseUrls').migrator);
  });
  afterAll(async () => {
    await migrator.close();
  });

  it('applied from scratch and are up to date', async () => {
    expect(await migrator.migrator.getPending()).toEqual([]);
    const executed = await migrator.migrator.getExecuted();
    expect(executed.map((m) => m.name)).toEqual(['Migration20261111000000_tenancy_workloads']);
  });

  it('enables RLS on every tenant-owned table, owned by the migrator role', async () => {
    const rows = await migrator.em
      .fork()
      .execute<{ relname: string; relrowsecurity: boolean; owner: string }[]>(
        `select c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) as owner
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'
        order by c.relname`,
      );
    expect(rows.map((r) => r.relname)).toEqual([
      'api_key',
      'membership',
      'team',
      'tenant',
      'workload',
    ]);
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.owner, row.relname).toBe('cloudpulse_migrator');
    }
  });

  it('reverts and re-applies cleanly', async () => {
    await migrator.migrator.down();
    expect(await migrator.migrator.getPending()).toHaveLength(1);
    await migrator.migrator.up();
    expect(await migrator.migrator.getPending()).toEqual([]);
  });
});
