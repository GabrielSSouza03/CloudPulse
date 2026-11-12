import { Type, type Static } from '@sinclair/typebox';
import { compileValidator } from '@cloudpulse/contracts';

export const PROCESS_ROLES = ['api', 'gateway', 'worker'] as const;
export type ProcessRole = (typeof PROCESS_ROLES)[number];

export const WORKER_ROLES = [
  'cost',
  'analytics-sink',
  'governance',
  'outbox-relay',
  'scheduler',
] as const;
export type WorkerRole = (typeof WORKER_ROLES)[number];

const Url = Type.String({ minLength: 1, pattern: '^[a-z][a-z0-9+.-]*://' });

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal('development'), Type.Literal('test'), Type.Literal('production')],
    {
      default: 'development',
    },
  ),
  LOG_LEVEL: Type.Union(
    ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].map((l) => Type.Literal(l)),
    { default: 'info' },
  ),
  DATABASE_URL: Type.Optional(Url),
  DATABASE_URL_API: Type.Optional(Url),
  DATABASE_URL_GATEWAY: Type.Optional(Url),
  DATABASE_URL_WORKER: Type.Optional(Url),
  DATABASE_POOL_MAX: Type.Integer({ minimum: 1, maximum: 200, default: 10 }),
  REDIS_URL: Url,
  KAFKA_BROKERS: Type.String({ minLength: 1 }),
  REDPANDA_ADMIN_URL: Url,
  CLICKHOUSE_URL: Url,
  API_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  GATEWAY_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3002 }),
  WORKER_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3003 }),
  AUTH_JWT_ISSUER: Type.String({ minLength: 1 }),
  AUTH_JWT_AUDIENCE: Type.String({ minLength: 1 }),
  AUTH_JWKS_URL: Type.Optional(Url),
  AUTH_DEV_JWKS_PATH: Type.Optional(Type.String({ minLength: 1 })),
  READINESS_TIMEOUT_MS: Type.Integer({ minimum: 100, maximum: 30_000, default: 2000 }),
});

type Env = Static<typeof EnvSchema>;

export type AppConfig = {
  env: Env['NODE_ENV'];
  logLevel: Env['LOG_LEVEL'];
  role: ProcessRole;
  workerRole: WorkerRole | null;
  port: number;
  database: { url: string; poolMax: number };
  redis: { url: string };
  kafka: { brokers: string[]; adminUrl: string };
  clickhouse: { url: string };
  auth: { issuer: string; audience: string; jwksUrl?: string; devJwksPath?: string };
  readinessTimeoutMs: number;
};

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(`invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

const validateEnv = compileValidator<Env>(EnvSchema, { coerceTypes: true, useDefaults: true });

/**
 * Builds the process configuration from environment variables and fails fast on any problem.
 * Each role reads `DATABASE_URL_<ROLE>` first, then `DATABASE_URL`.
 */
export function loadConfig(
  role: ProcessRole,
  workerRole: WorkerRole | null = null,
  source: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(EnvSchema.properties)) {
    const value = source[key];
    if (value !== undefined && value !== '') raw[key] = value;
  }
  const result = validateEnv(raw);
  if (!result.ok) {
    throw new ConfigError(
      result.errors.map((e) => `${e.path.replace(/^\//, '')}: ${e.code} (${e.message})`),
    );
  }
  const env = result.value;

  const problems: string[] = [];
  const roleDbUrl = {
    api: env.DATABASE_URL_API,
    gateway: env.DATABASE_URL_GATEWAY,
    worker: env.DATABASE_URL_WORKER,
  }[role];
  const databaseUrl = roleDbUrl ?? env.DATABASE_URL;
  if (!databaseUrl) problems.push(`DATABASE_URL_${role.toUpperCase()} or DATABASE_URL is required`);
  if (role === 'api' && !env.AUTH_JWKS_URL && !env.AUTH_DEV_JWKS_PATH) {
    problems.push('AUTH_JWKS_URL or AUTH_DEV_JWKS_PATH is required for the api role');
  }
  if (env.NODE_ENV === 'production' && env.AUTH_DEV_JWKS_PATH && !env.AUTH_JWKS_URL) {
    problems.push('AUTH_DEV_JWKS_PATH must not be the only key source in production');
  }
  if (role === 'worker' && !workerRole)
    problems.push(`worker requires --role=<${WORKER_ROLES.join('|')}>`);
  if (problems.length > 0) throw new ConfigError(problems);

  const port = { api: env.API_PORT, gateway: env.GATEWAY_PORT, worker: env.WORKER_PORT }[role];

  return {
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    role,
    workerRole,
    port,
    database: { url: databaseUrl as string, poolMax: env.DATABASE_POOL_MAX },
    redis: { url: env.REDIS_URL },
    kafka: {
      brokers: env.KAFKA_BROKERS.split(',').map((b) => b.trim()),
      adminUrl: env.REDPANDA_ADMIN_URL,
    },
    clickhouse: { url: env.CLICKHOUSE_URL },
    auth: {
      issuer: env.AUTH_JWT_ISSUER,
      audience: env.AUTH_JWT_AUDIENCE,
      ...(env.AUTH_JWKS_URL ? { jwksUrl: env.AUTH_JWKS_URL } : {}),
      ...(env.AUTH_DEV_JWKS_PATH ? { devJwksPath: env.AUTH_DEV_JWKS_PATH } : {}),
    },
    readinessTimeoutMs: env.READINESS_TIMEOUT_MS,
  };
}

/** Parses `--role=<value>` from argv for the worker entrypoint. */
export function parseWorkerRole(argv: readonly string[]): WorkerRole | null {
  const arg = argv.find((a) => a.startsWith('--role='));
  if (!arg) return null;
  const value = arg.slice('--role='.length);
  if (!(WORKER_ROLES as readonly string[]).includes(value)) {
    throw new ConfigError([
      `unknown worker role "${value}"; expected one of ${WORKER_ROLES.join(', ')}`,
    ]);
  }
  return value as WorkerRole;
}

export const APP_CONFIG = Symbol('AppConfig');
