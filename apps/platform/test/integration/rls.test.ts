import type { MikroORM } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { TenantTransactions } from '../../src/platform/database/tenant-transactions.js';
import { newId } from '../../src/shared-kernel/ids.js';
import {
  connect,
  insertWorkload,
  type SeededTenant,
  seedTenant,
  uniqueSlug,
} from './support/db.js';

/**
 * Database-enforced isolation. Every query here is raw SQL through `em.execute`, which the ORM
 * tenant filter does not touch, so only PostgreSQL row-level security stands between tenants.
 */
describe('row-level security (cloudpulse_api role)', () => {
  let migrator: MikroORM;
  let api: MikroORM;
  let worker: MikroORM;
  let tx: TenantTransactions;
  let a: SeededTenant;
  let b: SeededTenant;

  beforeAll(async () => {
    const urls = inject('databaseUrls');
    migrator = await connect(urls.migrator);
    // One connection, so a leaked session setting would be visible to the next transaction.
    api = await connect(urls.api, 1);
    worker = await connect(urls.worker, 1);
    tx = new TenantTransactions(api);
    a = await seedTenant(migrator, uniqueSlug('a'));
    b = await seedTenant(migrator, uniqueSlug('b'));
    await insertWorkload(migrator, a, 'a-bot');
    await insertWorkload(migrator, b, 'b-bot');
  });
  afterAll(async () => {
    await Promise.all([migrator.close(), api.close(), worker.close()]);
  });

  const countWorkloads = (em: { execute: MikroORM['em']['execute'] }, where = '') =>
    em
      .execute<{ n: number }[]>(`select count(*)::int as n from workload ${where}`)
      .then((r) => r[0]?.n);

  it('returns zero rows when no tenant is set (fails closed)', async () => {
    expect(await countWorkloads(api.em.fork())).toBe(0);
    const tenants = await api.em.fork().execute(`select * from tenant`);
    expect(tenants).toEqual([]);
  });

  it("sees only the current tenant's rows, even when asking for another tenant explicitly", async () => {
    await tx.run(a.tenantId, async (em) => {
      expect(await countWorkloads(em)).toBe(1);
      expect(await countWorkloads(em, `where tenant_id = '${b.tenantId}'`)).toBe(0);
      const keys = await em.execute<{ key: string }[]>(`select key from workload`);
      expect(keys.map((k) => k.key)).toEqual(['a-bot']);
    });
  });

  it("cannot write rows into another tenant's scope", async () => {
    await expect(
      tx.run(a.tenantId, (em) =>
        em.execute(
          `insert into workload (id, tenant_id, team_id, key, name, kind) values (?, ?, ?, 'x', 'x', 'agent')`,
          [newId(), b.tenantId, b.teamId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot update another tenant's rows", async () => {
    await tx.run(a.tenantId, async (em) => {
      await em.execute(`update workload set name = 'hijacked'`);
    });
    const names = await migrator.em
      .fork()
      .execute<{ name: string }[]>(`select name from workload where tenant_id = ?`, [b.tenantId]);
    expect(names.map((n) => n.name)).toEqual(['b-bot']);
  });

  it('cannot reference a team of another tenant (composite foreign key)', async () => {
    await expect(
      tx.run(a.tenantId, (em) =>
        em.execute(
          `insert into workload (id, tenant_id, team_id, key, name, kind) values (?, ?, ?, 'y', 'y', 'agent')`,
          [newId(), a.tenantId, b.teamId],
        ),
      ),
    ).rejects.toThrow(/workload_team_fk/);
  });

  it('does not leak tenant context to the next transaction on the same connection', async () => {
    await tx.run(a.tenantId, async (em) => expect(await countWorkloads(em)).toBe(1));
    const setting = await api.em
      .fork()
      .execute<{ v: string | null }[]>(`select current_setting('app.tenant_id', true) as v`);
    expect(setting[0]?.v ?? '').toBe('');
    expect(await countWorkloads(api.em.fork())).toBe(0);
  });

  it('cannot disable RLS, delete, or escalate privileges', async () => {
    const em = api.em.fork();
    await expect(em.execute(`alter table workload disable row level security`)).rejects.toThrow(
      /owner/,
    );
    await expect(em.execute(`delete from workload`)).rejects.toThrow(/permission denied/);
    await expect(em.execute(`set role cloudpulse_worker`)).rejects.toThrow(/permission denied/);
  });

  it('rejects a malformed tenant id before running any query', async () => {
    await expect(tx.run("x' or '1'='1", async () => 1)).rejects.toThrow(/UUID/);
  });

  it('lets the api role look up an API key across tenants only through the security-definer function', async () => {
    const em = api.em.fork();
    await expect(
      em.execute(`select * from cp_lookup_api_key('0000000000000000')`),
    ).resolves.toEqual([]);
    await expect(em.execute(`select secret_hash from api_key`)).resolves.toEqual([]);
  });

  it('worker role (BYPASSRLS) sees every tenant; repositories must scope it', async () => {
    const n = await countWorkloads(
      worker.em.fork(),
      `where tenant_id in ('${a.tenantId}', '${b.tenantId}')`,
    );
    expect(n).toBe(2);
  });
});
