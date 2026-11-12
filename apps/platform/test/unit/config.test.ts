import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseWorkerRole } from '../../src/platform/config/config.js';

const base = {
  REDIS_URL: 'redis://localhost:6379',
  KAFKA_BROKERS: 'a:9092, b:9092',
  REDPANDA_ADMIN_URL: 'http://localhost:9644',
  CLICKHOUSE_URL: 'http://localhost:8123',
  AUTH_JWT_ISSUER: 'https://issuer',
  AUTH_JWT_AUDIENCE: 'cloudpulse-api',
  AUTH_DEV_JWKS_PATH: './jwks.json',
};

describe('loadConfig', () => {
  it('picks the role-specific database url, coerces numbers and applies defaults', () => {
    const config = loadConfig('api', null, {
      ...base,
      DATABASE_URL: 'postgres://fallback/db',
      DATABASE_URL_API: 'postgres://api/db',
      API_PORT: '4000',
    });
    expect(config.database.url).toBe('postgres://api/db');
    expect(config.port).toBe(4000);
    expect(config.logLevel).toBe('info');
    expect(config.kafka.brokers).toEqual(['a:9092', 'b:9092']);
  });

  it('falls back to DATABASE_URL and treats empty strings as unset', () => {
    const config = loadConfig('gateway', null, {
      ...base,
      DATABASE_URL: 'postgres://x/db',
      DATABASE_URL_GATEWAY: '',
    });
    expect(config.database.url).toBe('postgres://x/db');
  });

  it('reports every problem at once', () => {
    const attempt = () => loadConfig('api', null, { REDIS_URL: 'not-a-url', API_PORT: 'abc' });
    expect(attempt).toThrow(ConfigError);
    const message = (() => {
      try {
        attempt();
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    })();
    expect(message).toContain('REDIS_URL');
    expect(message).toContain('API_PORT');
    expect(message).toContain('KAFKA_BROKERS');
  });

  it('requires a JWKS source for the api and forbids a dev-only key in production', () => {
    const { AUTH_DEV_JWKS_PATH: _drop, ...noJwks } = base;
    expect(() => loadConfig('api', null, { ...noJwks, DATABASE_URL: 'postgres://x/db' })).toThrow(
      /JWKS/,
    );
    expect(() =>
      loadConfig('api', null, { ...base, DATABASE_URL: 'postgres://x/db', NODE_ENV: 'production' }),
    ).toThrow(/production/);
  });

  it('requires a worker role for the worker process', () => {
    expect(() => loadConfig('worker', null, { ...base, DATABASE_URL: 'postgres://x/db' })).toThrow(
      /--role/,
    );
    expect(loadConfig('worker', 'cost', { ...base, DATABASE_URL: 'postgres://x/db' }).port).toBe(
      3003,
    );
  });
});

describe('parseWorkerRole', () => {
  it('parses known roles and rejects unknown ones', () => {
    expect(parseWorkerRole(['node', 'main.js', '--role=governance'])).toBe('governance');
    expect(parseWorkerRole(['node', 'main.js'])).toBeNull();
    expect(() => parseWorkerRole(['--role=miner'])).toThrow(ConfigError);
  });
});
