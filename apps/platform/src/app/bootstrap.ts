import 'reflect-metadata';
import type { DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  type AppConfig,
  ConfigError,
  loadConfig,
  parseWorkerRole,
  type ProcessRole,
} from '../platform/config/config.js';
import { REQUEST_ID_HEADER, generateRequestId } from '../platform/http/request-id.js';
import { createRootLogger, PinoNestLogger } from '../platform/logging/logger.js';

const MAX_BODY_BYTES = 1024 * 1024;

export async function createApp(
  config: AppConfig,
  rootModule: (config: AppConfig) => DynamicModule,
  options: { logger?: boolean } = {},
): Promise<NestFastifyApplication> {
  const logger = createRootLogger({
    level: options.logger === false ? 'silent' : config.logLevel,
    service: config.workerRole
      ? `cloudpulse-worker-${config.workerRole}`
      : `cloudpulse-${config.role}`,
    pretty: config.env === 'development' && process.stdout.isTTY,
  });
  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    genReqId: generateRequestId,
    bodyLimit: MAX_BODY_BYTES,
    trustProxy: false,
  });
  adapter.getInstance().addHook('onSend', async (request, reply) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
  });

  const app = await NestFactory.create<NestFastifyApplication>(rootModule(config), adapter, {
    logger: new PinoNestLogger(logger),
  });
  app.enableShutdownHooks();
  return app;
}

export async function bootstrap(
  role: ProcessRole,
  rootModule: (config: AppConfig) => DynamicModule,
): Promise<void> {
  let config: AppConfig;
  try {
    config = loadConfig(role, role === 'worker' ? parseWorkerRole(process.argv) : null);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
  const app = await createApp(config, rootModule);
  await app.listen({ port: config.port, host: '0.0.0.0' });
}
