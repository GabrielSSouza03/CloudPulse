import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CodedError, ValidationFailedError } from '../../shared-kernel/errors.js';
import {
  CATEGORY_STATUS,
  PROBLEM_CONTENT_TYPE,
  type ProblemDetails,
  problemType,
} from './problem.js';

const STATUS_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
  429: 'rate_limited',
  503: 'unavailable',
};

/** Maps every error to RFC 9457 problem details. Unknown errors become an opaque 500. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const problem = toProblem(exception);
    problem.instance = request.url.split('?')[0];
    problem.requestId = String(request.id);
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    if (traceId) problem.traceId = traceId;

    if (problem.status >= 500) {
      request.log.error({ err: exception, code: problem.code }, 'request failed');
    } else {
      request.log.info({ code: problem.code, status: problem.status }, 'request rejected');
    }

    void reply.status(problem.status).header('content-type', PROBLEM_CONTENT_TYPE).send(problem);
  }
}

export function toProblem(exception: unknown): ProblemDetails {
  if (exception instanceof CodedError) {
    const problem: ProblemDetails = {
      ...exception.extensions,
      type: problemType(exception.code),
      title: exception.title,
      status: CATEGORY_STATUS[exception.category],
      detail: exception.message,
      code: exception.code,
    };
    if (exception instanceof ValidationFailedError) problem.errors = exception.errors;
    return problem;
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = STATUS_CODES[status] ?? (status >= 500 ? 'internal_error' : 'bad_request');
    return { type: problemType(code), title: exception.message, status, code };
  }
  const fastifyError = exception as { statusCode?: number; message?: string };
  if (typeof fastifyError.statusCode === 'number' && fastifyError.statusCode < 500) {
    const status = fastifyError.statusCode;
    const code = STATUS_CODES[status] ?? 'bad_request';
    return {
      type: problemType(code),
      title: code.replace(/_/g, ' '),
      status,
      code,
      detail: fastifyError.message,
    };
  }
  return {
    type: problemType('internal_error'),
    title: 'Internal server error',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'internal_error',
  };
}
