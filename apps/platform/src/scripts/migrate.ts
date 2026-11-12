/**
 * Applies pending PostgreSQL migrations as the migrator role (table owner).
 *   node dist/scripts/migrate.js          apply all pending
 *   node dist/scripts/migrate.js --down   revert the last migration
 */
import { MikroORM } from '@mikro-orm/postgresql';
import { ormConfig } from '../app/orm.config.js';

const url = process.env.DATABASE_URL_MIGRATOR;
if (!url) {
  process.stderr.write('DATABASE_URL_MIGRATOR is required (see .env.example)\n');
  process.exit(1);
}

const orm = await MikroORM.init(ormConfig({ url }));
try {
  const migrator = orm.migrator;
  if (process.argv.includes('--down')) {
    const reverted = await migrator.down();
    process.stdout.write(`reverted: ${reverted.map((m) => m.name).join(', ') || 'nothing'}\n`);
  } else {
    const applied = await migrator.up();
    process.stdout.write(
      `applied: ${applied.map((m) => m.name).join(', ') || 'nothing (up to date)'}\n`,
    );
  }
} finally {
  await orm.close();
}
