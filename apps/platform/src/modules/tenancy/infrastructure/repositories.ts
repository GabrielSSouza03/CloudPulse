import type { EntityManager } from '@mikro-orm/postgresql';
import { ApiKey } from '../domain/api-key.js';
import { Membership } from '../domain/membership.js';
import { isRole, type Role } from '../domain/rbac.js';
import { Team } from '../domain/team.js';
import { Tenant } from '../domain/tenant.js';

/** Repositories are constructed per tenant transaction; `em` already carries tenant scope. */
export class TenancyRepository {
  constructor(private readonly em: EntityManager) {}

  findTenant(id: string): Promise<Tenant | null> {
    return this.em.findOne(Tenant, { id });
  }

  async rolesOf(subject: string): Promise<Role[]> {
    const memberships = await this.em.find(Membership, { subject }, { fields: ['role'] });
    return memberships.map((m) => m.role).filter(isRole);
  }

  addTeam(team: Team): void {
    this.em.persist(team);
  }

  listTeams(): Promise<Team[]> {
    return this.em.find(Team, {}, { orderBy: { name: 'asc' }, limit: 500 });
  }

  addApiKey(apiKey: ApiKey): void {
    this.em.persist(apiKey);
  }

  listApiKeys(): Promise<ApiKey[]> {
    return this.em.find(ApiKey, {}, { orderBy: { createdAt: 'desc' }, limit: 500 });
  }

  findApiKey(id: string): Promise<ApiKey | null> {
    return this.em.findOne(ApiKey, { id });
  }
}

export type ApiKeyLookup = {
  id: string;
  tenantId: string;
  secretHash: Buffer;
  scopes: string[];
  revokedAt: Date | null;
  tenantStatus: string;
};

/**
 * Cross-tenant lookup by public key id, for authenticating machine credentials before the tenant
 * is known. Goes through a SECURITY DEFINER function so the request role keeps RLS and never gets
 * a table-wide SELECT on api_key.
 */
export async function lookupApiKey(em: EntityManager, keyId: string): Promise<ApiKeyLookup | null> {
  const rows = await em.execute<
    {
      id: string;
      tenant_id: string;
      secret_hash: Buffer;
      scopes: string[];
      revoked_at: Date | null;
      tenant_status: string;
    }[]
  >('select * from cp_lookup_api_key(?)', [keyId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    secretHash: row.secret_hash,
    scopes: row.scopes,
    revokedAt: row.revoked_at,
    tenantStatus: row.tenant_status,
  };
}
