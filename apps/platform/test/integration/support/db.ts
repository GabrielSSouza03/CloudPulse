import { MikroORM } from '@mikro-orm/postgresql';
import { ormConfig } from '../../../src/app/orm.config.js';
import { newId } from '../../../src/shared-kernel/ids.js';

export async function connect(url: string, poolMax = 5): Promise<MikroORM> {
  return MikroORM.init(ormConfig({ url, poolMax }));
}

export type SeededTenant = { tenantId: string; teamId: string; subject: string };

/** Seeds through the migrator role (table owner), the way an operator or signup flow would. */
export async function seedTenant(
  migrator: MikroORM,
  slug: string,
  role = 'tenant_admin',
  subject = `${slug}-admin`,
): Promise<SeededTenant> {
  const tenantId = newId();
  const teamId = newId();
  const em = migrator.em.fork();
  await em.transactional(async (tx) => {
    await tx.execute(`insert into tenant (id, slug, name) values (?, ?, ?)`, [
      tenantId,
      slug,
      slug,
    ]);
    await tx.execute(`insert into team (id, tenant_id, name) values (?, ?, 'default')`, [
      teamId,
      tenantId,
    ]);
    await tx.execute(`insert into membership (id, tenant_id, subject, role) values (?, ?, ?, ?)`, [
      newId(),
      tenantId,
      subject,
      role,
    ]);
  });
  return { tenantId, teamId, subject };
}

export async function insertWorkload(
  migrator: MikroORM,
  tenant: SeededTenant,
  key: string,
): Promise<string> {
  const id = newId();
  await migrator.em
    .fork()
    .execute(
      `insert into workload (id, tenant_id, team_id, key, name, kind) values (?, ?, ?, ?, ?, 'agent')`,
      [id, tenant.tenantId, tenant.teamId, key, key],
    );
  return id;
}

export const uniqueSlug = (prefix: string): string => `${prefix}-${newId().slice(-12)}`;
