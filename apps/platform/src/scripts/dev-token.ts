/**
 * Local development only. Creates a signing key under .dev/ (once), ensures a tenant, a default
 * team and a membership exist, and prints a JWT the api accepts.
 *
 *   pnpm dev:token -- --tenant acme --subject alice --role tenant_admin
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MikroORM } from '@mikro-orm/postgresql';
import { exportJWK, generateKeyPair, importJWK, type JWK, SignJWT } from 'jose';
import { ormConfig } from '../app/orm.config.js';
import { ROLES, type Role } from '../modules/tenancy/index.js';
import { TENANT_CLAIM } from '../platform/auth/jwt-verifier.js';
import { newId } from '../shared-kernel/ids.js';

if (process.env.NODE_ENV === 'production') {
  process.stderr.write('dev-token refuses to run with NODE_ENV=production\n');
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    tenant: { type: 'string', default: 'acme' },
    subject: { type: 'string', default: 'dev-admin' },
    role: { type: 'string', default: 'tenant_admin' },
    ttl: { type: 'string', default: '8h' },
  },
});
const role = values.role as Role;
if (!ROLES.includes(role)) {
  process.stderr.write(`unknown role ${values.role}; expected one of ${ROLES.join(', ')}\n`);
  process.exit(1);
}

const devDir = new URL('../../../../.dev/', import.meta.url);
const privatePath = new URL('signing-key.json', devDir);
const jwksPath = new URL('jwks.json', devDir);

type SigningKey = Awaited<ReturnType<typeof importJWK>>;

async function signingKey(): Promise<{ key: SigningKey; kid: string }> {
  try {
    const jwk = JSON.parse(await readFile(privatePath, 'utf8')) as JWK;
    return { key: await importJWK(jwk, 'EdDSA'), kid: jwk.kid as string };
  } catch {
    const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
    const kid = newId();
    const privateJwk = { ...(await exportJWK(privateKey)), kid, alg: 'EdDSA', use: 'sig' };
    const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'EdDSA', use: 'sig' };
    await mkdir(devDir, { recursive: true });
    await writeFile(privatePath, JSON.stringify(privateJwk, null, 2), { mode: 0o600 });
    await writeFile(jwksPath, JSON.stringify({ keys: [publicJwk] }, null, 2));
    process.stderr.write(`created dev signing key in ${devDir.pathname}\n`);
    return { key: privateKey, kid };
  }
}

async function ensureTenant(slug: string, subject: string): Promise<string> {
  const url = process.env.DATABASE_URL_MIGRATOR;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR is required (see .env.example)');
  const orm = await MikroORM.init(ormConfig({ url }));
  try {
    const em = orm.em.fork();
    return await em.transactional(async (tx) => {
      const [tenant] = await tx.execute<{ id: string }[]>(
        `insert into tenant (id, slug, name) values (?, ?, ?)
         on conflict (slug) do update set slug = excluded.slug returning id`,
        [newId(), slug, slug],
      );
      const tenantId = (tenant as { id: string }).id;
      await tx.execute(
        `insert into team (id, tenant_id, name) values (?, ?, 'default') on conflict (tenant_id, name) do nothing`,
        [newId(), tenantId],
      );
      await tx.execute(
        `insert into membership (id, tenant_id, subject, role) values (?, ?, ?, ?)
         on conflict (tenant_id, subject, role) do nothing`,
        [newId(), tenantId, subject, role],
      );
      return tenantId;
    });
  } finally {
    await orm.close();
  }
}

const issuer = process.env.AUTH_JWT_ISSUER ?? 'https://dev.cloudpulse.local';
const audience = process.env.AUTH_JWT_AUDIENCE ?? 'cloudpulse-api';

const tenantId = await ensureTenant(values.tenant, values.subject);
const { key, kid } = await signingKey();
const token = await new SignJWT({ [TENANT_CLAIM]: tenantId })
  .setProtectedHeader({ alg: 'EdDSA', kid })
  .setSubject(values.subject)
  .setIssuer(issuer)
  .setAudience(audience)
  .setIssuedAt()
  .setExpirationTime(values.ttl)
  .sign(key);

process.stderr.write(
  `tenant=${values.tenant} (${tenantId}) subject=${values.subject} role=${role}\n`,
);
process.stdout.write(`${token}\n`);
