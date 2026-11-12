import { Injectable } from '@nestjs/common';
import type { Identity } from '../../../platform/auth/jwt-verifier.js';
import { TenantTransactions } from '../../../platform/database/tenant-transactions.js';
import { ForbiddenError } from '../../../shared-kernel/errors.js';
import type { Actor } from '../domain/actor.js';
import { TenancyRepository } from '../infrastructure/repositories.js';

/**
 * Turns a verified identity into an Actor. Roles come from CloudPulse memberships, not from token
 * claims: the IdP authenticates, CloudPulse decides what the subject may do in each tenant.
 */
@Injectable()
export class ActorResolver {
  constructor(private readonly tx: TenantTransactions) {}

  async resolve(identity: Identity): Promise<Actor> {
    const { tenant, roles } = await this.tx.run(identity.tenantId, async (em) => {
      const repo = new TenancyRepository(em);
      const [tenant, roles] = await Promise.all([
        repo.findTenant(identity.tenantId),
        repo.rolesOf(identity.subject),
      ]);
      return { tenant, roles };
    });
    if (!tenant || !tenant.isActive())
      throw new ForbiddenError('Tenant is unknown or suspended.', 'tenant_inactive');
    if (roles.length === 0)
      throw new ForbiddenError('Subject has no membership in this tenant.', 'not_a_member');
    return { kind: 'user', subject: identity.subject, tenantId: identity.tenantId, roles };
  }
}
