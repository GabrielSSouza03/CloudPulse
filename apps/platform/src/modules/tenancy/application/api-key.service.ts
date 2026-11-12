import { Inject, Injectable } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import { TenantTransactions } from '../../../platform/database/tenant-transactions.js';
import { CLOCK, type Clock } from '../../../shared-kernel/clock.js';
import { NotFoundError, UnauthenticatedError } from '../../../shared-kernel/errors.js';
import { newId } from '../../../shared-kernel/ids.js';
import { type Actor, authorize } from '../domain/actor.js';
import { ApiKey, type ApiKeyScope, parseApiKey, secretMatches } from '../domain/api-key.js';
import { lookupApiKey, TenancyRepository } from '../infrastructure/repositories.js';

export type ApiKeyView = {
  id: string;
  keyId: string;
  name: string;
  scopes: ApiKeyScope[];
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
};

export type IssuedApiKey = ApiKeyView & { secret: string };

/** Result of authenticating a machine credential. */
export type ApiKeyPrincipal = {
  kind: 'api_key';
  apiKeyId: string;
  tenantId: string;
  scopes: string[];
};

const toView = (k: ApiKey): ApiKeyView => ({
  id: k.id,
  keyId: k.keyId,
  name: k.name,
  scopes: k.scopes,
  createdBy: k.createdBy,
  createdAt: k.createdAt.toISOString(),
  revokedAt: k.revokedAt ? k.revokedAt.toISOString() : null,
});

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly tx: TenantTransactions,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async issue(actor: Actor, input: { name: string; scopes: ApiKeyScope[] }): Promise<IssuedApiKey> {
    authorize(actor, 'api_keys:write');
    const { apiKey, plaintext } = ApiKey.issue({
      id: newId(),
      tenantId: actor.tenantId,
      name: input.name,
      scopes: input.scopes,
      createdBy: actor.subject,
      now: this.clock.now(),
    });
    await this.tx.run(actor.tenantId, async (em) => new TenancyRepository(em).addApiKey(apiKey));
    return { ...toView(apiKey), secret: plaintext };
  }

  async list(actor: Actor): Promise<ApiKeyView[]> {
    authorize(actor, 'api_keys:read');
    const keys = await this.tx.run(actor.tenantId, (em) => new TenancyRepository(em).listApiKeys());
    return keys.map(toView);
  }

  async revoke(actor: Actor, id: string): Promise<void> {
    authorize(actor, 'api_keys:write');
    await this.tx.run(actor.tenantId, async (em) => {
      const apiKey = await new TenancyRepository(em).findApiKey(id);
      if (!apiKey) throw new NotFoundError('API key');
      apiKey.revoke(this.clock.now());
    });
  }
}

/**
 * Authenticates `cp_live_...` keys. Every failure mode returns the same error so callers cannot
 * probe which key ids exist or are revoked.
 */
@Injectable()
export class ApiKeyAuthenticator {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  async authenticate(plaintext: string, requiredScope: ApiKeyScope): Promise<ApiKeyPrincipal> {
    const parsed = parseApiKey(plaintext);
    const record = parsed ? await lookupApiKey(this.orm.em.fork(), parsed.keyId) : null;
    if (
      !parsed ||
      !record ||
      !secretMatches(parsed.secret, record.secretHash) ||
      record.revokedAt !== null ||
      record.tenantStatus !== 'active' ||
      !record.scopes.includes(requiredScope)
    ) {
      throw new UnauthenticatedError('Invalid API key.');
    }
    return {
      kind: 'api_key',
      apiKeyId: record.id,
      tenantId: record.tenantId,
      scopes: record.scopes,
    };
  }
}
