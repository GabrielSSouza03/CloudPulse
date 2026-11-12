import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { IngestionModule } from '../modules/ingestion/index.js';
import {
  ActorGuard,
  TenancyAuthenticationModule,
  TenancyModule,
} from '../modules/tenancy/index.js';
import { WorkloadsModule } from '../modules/workloads/index.js';
import type { AppConfig } from '../platform/config/config.js';
import { ProblemDetailsFilter } from '../platform/http/problem-details.filter.js';
import { CoreModule } from './core.module.js';

const problemFilter = { provide: APP_FILTER, useClass: ProblemDetailsFilter };

/** Control-plane REST API. Every route requires a JWT unless marked @Public(). */
@Module({})
export class ApiAppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ApiAppModule,
      imports: [CoreModule.forRoot(config), TenancyModule, WorkloadsModule],
      providers: [problemFilter, { provide: APP_GUARD, useExisting: ActorGuard }],
    };
  }
}

/** Telemetry gateway: the ingestion hot path. Machine credentials only. */
@Module({})
export class GatewayAppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: GatewayAppModule,
      imports: [CoreModule.forRoot(config), TenancyAuthenticationModule, IngestionModule],
      providers: [problemFilter],
    };
  }
}

/** Stream and scheduled workers. Phase 1 exposes health only; consumers arrive with Phase 2. */
@Module({})
export class WorkerAppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: WorkerAppModule,
      imports: [CoreModule.forRoot(config)],
      providers: [problemFilter],
    };
  }
}
