import { Inject, Injectable } from '@nestjs/common';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { isUuid } from '../../shared-kernel/ids.js';

export const TENANT_FILTER = 'tenant';
/** PostgreSQL setting read by RLS policies: `current_setting('app.tenant_id', true)`. */
export const TENANT_SETTING = 'app.tenant_id';

/**
 * Runs work inside one PostgreSQL transaction scoped to one tenant:
 * - `set_config('app.tenant_id', ..., true)` is transaction-local, so pooled connections never
 *   leak tenant context between requests; RLS policies read it.
 * - the MikroORM `tenant` filter adds `tenant_id = ?` to every query on tenant-owned entities.
 * A missing or malformed tenant id is rejected before any query runs.
 */
@Injectable()
export class TenantTransactions {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  async run<T>(tenantId: string, work: (em: EntityManager) => Promise<T>): Promise<T> {
    if (!isUuid(tenantId)) throw new Error('tenant transaction requires a UUID tenant id');
    const em = this.orm.em.fork({ clear: true });
    em.setSessionContext({ variables: { [TENANT_SETTING]: tenantId } });
    em.setFilterParams(TENANT_FILTER, { tenantId });
    return em.transactional((txEm) => work(txEm));
  }
}
