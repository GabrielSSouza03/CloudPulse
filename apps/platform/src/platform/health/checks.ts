import { connect } from 'node:net';
import type { MikroORM } from '@mikro-orm/postgresql';

export type DependencyName = 'postgres' | 'redis' | 'redpanda' | 'clickhouse';

export type DependencyCheck = {
  name: DependencyName;
  check: (signal: AbortSignal) => Promise<void>;
};

export const DEPENDENCY_CHECKS = Symbol('DependencyChecks');

export function postgresCheck(orm: MikroORM): DependencyCheck {
  return {
    name: 'postgres',
    check: async (signal) => {
      await Promise.race([
        orm.em.fork().execute('select 1'),
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(new Error('timeout'))),
        ),
      ]);
    },
  };
}

/** Minimal RESP PING over TCP; avoids pulling a Redis client in before Phase 2 needs one. */
export function redisCheck(url: string): DependencyCheck {
  const { hostname, port } = new URL(url);
  return {
    name: 'redis',
    check: (signal) =>
      new Promise<void>((resolve, reject) => {
        const socket = connect({ host: hostname, port: Number(port || 6379), signal });
        socket.once('error', reject);
        socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'));
        socket.once('data', (data) => {
          socket.end();
          if (data.toString().startsWith('+PONG')) resolve();
          else reject(new Error(`unexpected reply: ${data.toString().trim()}`));
        });
      }),
  };
}

export function redpandaCheck(adminUrl: string): DependencyCheck {
  return {
    name: 'redpanda',
    check: async (signal) => {
      const response = await fetch(new URL('/v1/status/ready', adminUrl), { signal });
      if (!response.ok) throw new Error(`status ${response.status}`);
    },
  };
}

export function clickhouseCheck(url: string): DependencyCheck {
  return {
    name: 'clickhouse',
    check: async (signal) => {
      const response = await fetch(new URL('/ping', url), { signal });
      if (!response.ok) throw new Error(`status ${response.status}`);
    },
  };
}
