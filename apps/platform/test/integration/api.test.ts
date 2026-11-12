import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MikroORM } from '@mikro-orm/postgresql';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../../src/app/bootstrap.js';
import { ApiAppModule } from '../../src/app/role-modules.js';
import { ApiKeyAuthenticator } from '../../src/modules/tenancy/index.js';
import { loadConfig } from '../../src/platform/config/config.js';
import { UnauthenticatedError } from '../../src/shared-kernel/errors.js';
import { newId } from '../../src/shared-kernel/ids.js';
import { connect, type SeededTenant, seedTenant, uniqueSlug } from './support/db.js';

const ISSUER = 'https://test.cloudpulse.local';
const AUDIENCE = 'cloudpulse-api';

describe('control-plane API (end to end)', () => {
  let app: NestFastifyApplication;
  let migrator: MikroORM;
  let sign: (
    claims: { sub: string; tid: string },
    options?: { issuer?: string; expiresIn?: string },
  ) => Promise<string>;
  let acme: SeededTenant;
  let globex: SeededTenant;
  let adminToken: string;

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, token?: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload ? { payload } : {}),
    });

  beforeAll(async () => {
    const urls = inject('databaseUrls');
    migrator = await connect(urls.migrator);
    acme = await seedTenant(migrator, uniqueSlug('acme'), 'tenant_admin', 'alice');
    globex = await seedTenant(migrator, uniqueSlug('globex'), 'tenant_admin', 'gina');
    await migrator.em
      .fork()
      .execute(
        `insert into membership (id, tenant_id, subject, role) values (?, ?, 'eve', 'engineer')`,
        [newId(), acme.tenantId],
      );

    const { publicKey, privateKey } = await generateKeyPair('EdDSA');
    const kid = 'test-key';
    const dir = await mkdtemp(join(tmpdir(), 'cloudpulse-jwks-'));
    const jwksPath = join(dir, 'jwks.json');
    await writeFile(
      jwksPath,
      JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), kid, alg: 'EdDSA' }] }),
    );
    sign = (claims, options = {}) =>
      new SignJWT({ tid: claims.tid })
        .setProtectedHeader({ alg: 'EdDSA', kid })
        .setSubject(claims.sub)
        .setIssuer(options.issuer ?? ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(options.expiresIn ?? '5m')
        .sign(privateKey);
    adminToken = await sign({ sub: 'alice', tid: acme.tenantId });

    const config = loadConfig('api', null, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL_API: urls.api,
      REDIS_URL: 'redis://unused:6379',
      KAFKA_BROKERS: 'unused:9092',
      REDPANDA_ADMIN_URL: 'http://unused:9644',
      CLICKHOUSE_URL: 'http://unused:8123',
      AUTH_JWT_ISSUER: ISSUER,
      AUTH_JWT_AUDIENCE: AUDIENCE,
      AUTH_DEV_JWKS_PATH: jwksPath,
    });
    app = await createApp(config, (c) => ApiAppModule.forRoot(c), { logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    await migrator?.close();
  });

  describe('health', () => {
    it('reports postgres readiness for the api role without authentication', async () => {
      const res = await call('GET', '/health/ready');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        status: 'ok',
        role: 'api',
        checks: { postgres: { status: 'up' } },
      });
      expect(res.headers['x-request-id']).toBeTruthy();
    });
  });

  describe('authentication', () => {
    it('rejects missing, forged, foreign-issuer and expired tokens with problem+json', async () => {
      const forged = `${adminToken.slice(0, -4)}AAAA`;
      const foreign = await sign(
        { sub: 'alice', tid: acme.tenantId },
        { issuer: 'https://evil.example' },
      );
      const expired = await sign({ sub: 'alice', tid: acme.tenantId }, { expiresIn: '-10m' });
      for (const token of [undefined, 'not-a-jwt', forged, foreign, expired]) {
        const res = await call('GET', '/v1/workloads', token);
        expect(res.statusCode, String(token)).toBe(401);
        expect(res.headers['content-type']).toContain('application/problem+json');
        expect(res.json().code).toBe('unauthenticated');
      }
    });

    it('rejects a valid token for a tenant where the subject has no membership', async () => {
      const token = await sign({ sub: 'alice', tid: globex.tenantId });
      const res = await call('GET', '/v1/workloads', token);
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('not_a_member');
    });
  });

  describe('workloads', () => {
    it('registers, lists with keyset pagination, and rejects duplicate keys', async () => {
      for (const key of ['wl-1', 'wl-2', 'wl-3']) {
        const res = await call('POST', '/v1/workloads', adminToken, {
          teamId: acme.teamId,
          key,
          name: key,
          kind: 'agent',
          tags: { env: 'test' },
        });
        expect(res.statusCode, res.body).toBe(201);
      }
      const dup = await call('POST', '/v1/workloads', adminToken, {
        teamId: acme.teamId,
        key: 'wl-1',
        name: 'x',
        kind: 'agent',
      });
      expect(dup.statusCode).toBe(409);
      expect(dup.json().code).toBe('workload_key_conflict');

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const query: string = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
        const page = await call('GET', `/v1/workloads${query}`, adminToken);
        expect(page.statusCode).toBe(200);
        const body = page.json() as { items: { key: string }[]; nextCursor: string | null };
        seen.push(...body.items.map((i) => i.key));
        cursor = body.nextCursor;
      } while (cursor);
      expect(seen.sort()).toEqual(['wl-1', 'wl-2', 'wl-3']);
    });

    it("cannot attach a workload to another tenant's team", async () => {
      const res = await call('POST', '/v1/workloads', adminToken, {
        teamId: globex.teamId,
        key: 'cross',
        name: 'cross',
        kind: 'agent',
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('team_not_found');
    });

    it("never shows one tenant's workloads to another", async () => {
      const token = await sign({ sub: 'gina', tid: globex.tenantId });
      const res = await call('GET', '/v1/workloads', token);
      expect(res.statusCode).toBe(200);
      expect(res.json().items).toEqual([]);
    });

    it('lets engineers read but not register workloads', async () => {
      const token = await sign({ sub: 'eve', tid: acme.tenantId });
      expect((await call('GET', '/v1/workloads', token)).statusCode).toBe(200);
      const res = await call('POST', '/v1/workloads', token, {
        teamId: acme.teamId,
        key: 'eve',
        name: 'e',
        kind: 'agent',
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('permission_denied');
    });

    it('validates input with field-level error codes and rejects a tampered cursor', async () => {
      const res = await call('POST', '/v1/workloads', adminToken, {
        teamId: 'nope',
        key: 'bad key',
        name: '',
        kind: 'robot',
      });
      expect(res.statusCode).toBe(400);
      const paths = (res.json().errors as { path: string }[]).map((e) => e.path);
      expect(paths).toEqual(expect.arrayContaining(['/teamId', '/key', '/kind']));
      expect((await call('GET', '/v1/workloads?cursor=garbage', adminToken)).statusCode).toBe(400);
    });
  });

  describe('API keys', () => {
    it('shows the secret once, authenticates it, and stops accepting it after revocation', async () => {
      const authenticator = app.get(ApiKeyAuthenticator);
      const created = await call('POST', '/v1/api-keys', adminToken, {
        name: 'ingest',
        scopes: ['ingest:write'],
      });
      expect(created.statusCode, created.body).toBe(201);
      const { id, secret } = created.json() as { id: string; secret: string };
      expect(secret).toMatch(/^cp_live_[0-9a-f]{16}_[A-Za-z0-9_-]{43}$/);

      const listed = await call('GET', '/v1/api-keys', adminToken);
      expect(listed.body).not.toContain(secret.slice(-43));
      expect(listed.body).not.toContain('secretHash');

      await expect(authenticator.authenticate(secret, 'ingest:write')).resolves.toMatchObject({
        kind: 'api_key',
        apiKeyId: id,
        tenantId: acme.tenantId,
      });
      const wrongSecret = `${secret.slice(0, -1)}${secret.endsWith('A') ? 'B' : 'A'}`;
      await expect(authenticator.authenticate(wrongSecret, 'ingest:write')).rejects.toThrow(
        UnauthenticatedError,
      );

      expect((await call('DELETE', `/v1/api-keys/${id}`, adminToken)).statusCode).toBe(204);
      await expect(authenticator.authenticate(secret, 'ingest:write')).rejects.toThrow(
        'Invalid API key.',
      );
    });

    it('rejects keys of suspended tenants and hides keys across tenants', async () => {
      const authenticator = app.get(ApiKeyAuthenticator);
      const globexToken = await sign({ sub: 'gina', tid: globex.tenantId });
      const created = await call('POST', '/v1/api-keys', globexToken, {
        name: 'g',
        scopes: ['ingest:write'],
      });
      const { id, secret } = created.json() as { id: string; secret: string };

      expect((await call('DELETE', `/v1/api-keys/${id}`, adminToken)).statusCode).toBe(404);
      expect((await call('GET', '/v1/api-keys', adminToken)).body).not.toContain(id);

      await migrator.em
        .fork()
        .execute(`update tenant set status = 'suspended' where id = ?`, [globex.tenantId]);
      await expect(authenticator.authenticate(secret, 'ingest:write')).rejects.toThrow(
        'Invalid API key.',
      );
    });

    it('only tenant admins can issue keys', async () => {
      const token = await sign({ sub: 'eve', tid: acme.tenantId });
      const res = await call('POST', '/v1/api-keys', token, {
        name: 'x',
        scopes: ['ingest:write'],
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
