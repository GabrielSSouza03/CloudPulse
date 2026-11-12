import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/public.decorator.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DEPENDENCY_CHECKS, type DependencyCheck } from './checks.js';

type CheckResult = { status: 'up' | 'down'; latencyMs: number; error?: string };

/** Connection failures surface as AggregateError with an empty message; the errno code is what operators need. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const code = (error as { code?: unknown }).code;
  if (error.message) return error.message;
  if (typeof code === 'string') return code;
  if (error instanceof AggregateError && error.errors.length > 0)
    return describeError(error.errors[0]);
  return error.name;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DEPENDENCY_CHECKS) private readonly checks: DependencyCheck[],
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Liveness: the process is running. Never checks dependencies, so outages do not cause restarts. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: every dependency this process role needs answers within the timeout. */
  @Get('ready')
  async ready(@Res() reply: FastifyReply): Promise<void> {
    const entries = await Promise.all(
      this.checks.map(async ({ name, check }): Promise<[string, CheckResult]> => {
        const started = performance.now();
        const signal = AbortSignal.timeout(this.config.readinessTimeoutMs);
        try {
          await check(signal);
          return [name, { status: 'up', latencyMs: Math.round(performance.now() - started) }];
        } catch (error) {
          const message = signal.aborted ? 'timeout' : describeError(error);
          return [
            name,
            { status: 'down', latencyMs: Math.round(performance.now() - started), error: message },
          ];
        }
      }),
    );
    const allUp = entries.every(([, r]) => r.status === 'up');
    void reply.status(allUp ? 200 : 503).send({
      status: allUp ? 'ok' : 'unavailable',
      role: this.config.workerRole
        ? `${this.config.role}:${this.config.workerRole}`
        : this.config.role,
      checks: Object.fromEntries(entries),
    });
  }
}
