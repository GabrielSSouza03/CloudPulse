import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { describeError } from '../../src/platform/health/health.controller.js';
import { decodeCursor, encodeCursor } from '../../src/platform/http/cursor.js';
import { toProblem } from '../../src/platform/http/problem-details.filter.js';
import { ConflictError, ValidationFailedError } from '../../src/shared-kernel/errors.js';

describe('toProblem', () => {
  it('maps coded errors to RFC 9457 with a stable code', () => {
    const problem = toProblem(
      new ConflictError('workload_key_conflict', 'Workload key "x" is already registered.'),
    );
    expect(problem).toMatchObject({
      type: 'https://cloudpulse.dev/problems/workload-key-conflict',
      status: 409,
      code: 'workload_key_conflict',
      detail: 'Workload key "x" is already registered.',
    });
  });

  it('includes field errors for validation failures', () => {
    const problem = toProblem(
      new ValidationFailedError([{ path: '/name', code: 'required', message: 'required' }]),
    );
    expect(problem.status).toBe(400);
    expect(problem.errors).toEqual([{ path: '/name', code: 'required', message: 'required' }]);
  });

  it('maps Nest and Fastify client errors', () => {
    expect(toProblem(new NotFoundException()).code).toBe('not_found');
    expect(toProblem({ statusCode: 413, message: 'Request body is too large' })).toMatchObject({
      status: 413,
      code: 'payload_too_large',
    });
  });

  it('hides internals of unknown errors', () => {
    const problem = toProblem(new Error('connection string postgres://user:secret@db'));
    expect(problem).toEqual({
      type: 'https://cloudpulse.dev/problems/internal-error',
      title: 'Internal server error',
      status: 500,
      code: 'internal_error',
    });
  });
});

describe('cursor', () => {
  it('round-trips ids and rejects tampered cursors with a 400', () => {
    const id = '01a1ca14-350b-7180-8b3f-95a47762e650';
    expect(decodeCursor(encodeCursor(id))).toBe(id);
    expect(() => decodeCursor('not-base64-json')).toThrow(ValidationFailedError);
    expect(() => decodeCursor(Buffer.from('{"id":"1 or 1=1"}').toString('base64url'))).toThrow(
      ValidationFailedError,
    );
  });
});

describe('describeError', () => {
  it('uses the errno code when the message is empty', () => {
    const refused = Object.assign(new Error(''), { code: 'ECONNREFUSED' });
    expect(describeError(refused)).toBe('ECONNREFUSED');
    expect(describeError(new AggregateError([refused], ''))).toBe('ECONNREFUSED');
    expect(describeError('x')).toBe('unknown error');
  });
});
