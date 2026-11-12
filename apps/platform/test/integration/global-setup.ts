import { fileURLToPath } from 'node:url';
import { MikroORM } from '@mikro-orm/postgresql';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { ormConfig } from '../../src/app/orm.config.js';

const IMAGE = 'postgres:18.6-alpine';
const INIT_SCRIPT = fileURLToPath(
  new URL('../../../../infra/compose/postgres/init/01-roles.sh', import.meta.url),
);

export type DatabaseUrls = { migrator: string; api: string; worker: string };

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrls: DatabaseUrls;
  }
}

/** One PostgreSQL per integration run, initialized exactly like the compose stack, then migrated. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(IMAGE)
    .withDatabase('cloudpulse')
    .withUsername('postgres')
    .withPassword('postgres')
    .withEnvironment({
      CLOUDPULSE_MIGRATOR_PASSWORD: 'migrator',
      CLOUDPULSE_API_PASSWORD: 'api',
      CLOUDPULSE_WORKER_PASSWORD: 'worker',
    })
    .withCopyFilesToContainer([
      { source: INIT_SCRIPT, target: '/docker-entrypoint-initdb.d/01-roles.sh', mode: 0o755 },
    ])
    .start();

  const hostPort = `${container.getHost()}:${container.getPort()}`;
  const urls: DatabaseUrls = {
    migrator: `postgres://cloudpulse_migrator:migrator@${hostPort}/cloudpulse`,
    api: `postgres://cloudpulse_api:api@${hostPort}/cloudpulse`,
    worker: `postgres://cloudpulse_worker:worker@${hostPort}/cloudpulse`,
  };

  const orm = await MikroORM.init(ormConfig({ url: urls.migrator }));
  try {
    await orm.migrator.up();
  } finally {
    await orm.close();
  }

  project.provide('databaseUrls', urls);
  return async () => {
    await container.stop();
  };
}
