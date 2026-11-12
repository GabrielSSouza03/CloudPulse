import { trace } from '@opentelemetry/api';
import { type LoggerService } from '@nestjs/common';
import { pino, type Logger, type LoggerOptions } from 'pino';

/** Paths never written to logs. Covers request headers, bodies and config objects. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.secret',
  '*.apiKey',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  'secret',
  'token',
  'password',
];

export function createRootLogger(options: {
  level: string;
  service: string;
  pretty?: boolean;
}): Logger {
  const config: LoggerOptions = {
    level: options.level,
    base: { service: options.service },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    mixin() {
      const span = trace.getActiveSpan();
      if (!span) return {};
      const { traceId, spanId } = span.spanContext();
      return { traceId, spanId };
    },
  };
  if (options.pretty) {
    config.transport = {
      target: 'pino-pretty',
      options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
    };
  }
  return pino(config);
}

/** Routes Nest framework logs through the same pino instance as request logs. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }
  error(message: unknown, stackOrContext?: string, context?: string): void {
    const ctx = context ?? stackOrContext;
    const stack = context ? stackOrContext : undefined;
    this.logger.error({ context: ctx, ...(stack ? { stack } : {}) }, String(message));
  }
  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }
  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }
  verbose(message: unknown, context?: string): void {
    this.write('trace', message, context);
  }
  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  private write(
    level: 'info' | 'warn' | 'debug' | 'trace' | 'fatal',
    message: unknown,
    context?: string,
  ): void {
    if (typeof message === 'object' && message !== null) {
      this.logger[level]({ context, ...(message as object) });
    } else {
      this.logger[level]({ context }, String(message));
    }
  }
}
