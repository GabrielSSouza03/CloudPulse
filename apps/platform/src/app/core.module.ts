import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import { JwtVerifier } from '../platform/auth/jwt-verifier.js';
import { APP_CONFIG, type AppConfig } from '../platform/config/config.js';
import { TenantTransactions } from '../platform/database/tenant-transactions.js';
import {
  clickhouseCheck,
  DEPENDENCY_CHECKS,
  type DependencyCheck,
  postgresCheck,
  redisCheck,
  redpandaCheck,
} from '../platform/health/checks.js';
import { HealthController } from '../platform/health/health.controller.js';
import { CLOCK, SystemClock } from '../shared-kernel/clock.js';
import { ormConfig } from './orm.config.js';
import { dependenciesFor } from './role-dependencies.js';

class OrmShutdown implements OnApplicationShutdown {
  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}
  async onApplicationShutdown(): Promise<void> {
    await this.orm.close();
  }
}

/** Process-wide infrastructure shared by every role: config, clock, database, health. */
@Global()
@Module({})
export class CoreModule {
  static forRoot(config: AppConfig): DynamicModule {
    const providers: Provider[] = [
      { provide: APP_CONFIG, useValue: config },
      { provide: CLOCK, useClass: SystemClock },
      {
        provide: MikroORM,
        useFactory: () =>
          MikroORM.init(
            ormConfig({ url: config.database.url, poolMax: config.database.poolMax, debug: false }),
          ),
      },
      OrmShutdown,
      TenantTransactions,
      JwtVerifier,
      {
        provide: DEPENDENCY_CHECKS,
        inject: [MikroORM],
        useFactory: (orm: MikroORM): DependencyCheck[] =>
          dependenciesFor(config.role, config.workerRole).map((name) => {
            switch (name) {
              case 'postgres':
                return postgresCheck(orm);
              case 'redis':
                return redisCheck(config.redis.url);
              case 'redpanda':
                return redpandaCheck(config.kafka.adminUrl);
              case 'clickhouse':
                return clickhouseCheck(config.clickhouse.url);
            }
          }),
      },
    ];
    return {
      module: CoreModule,
      controllers: [HealthController],
      providers,
      exports: [APP_CONFIG, CLOCK, MikroORM, TenantTransactions, JwtVerifier],
    };
  }
}
