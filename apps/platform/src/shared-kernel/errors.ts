import type { ValidationIssue } from '@cloudpulse/contracts';

/** Transport-neutral error category. The HTTP layer maps each one to a status code. */
export type ErrorCategory =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unprocessable'
  | 'unavailable';

/**
 * Error with a stable machine-readable `code`. Clients may branch on the code, so never rename one.
 * Domain and application layers throw these; anything else becomes an opaque internal error.
 */
export class CodedError extends Error {
  constructor(
    readonly category: ErrorCategory,
    readonly code: string,
    readonly title: string,
    detail?: string,
    readonly extensions: Record<string, unknown> = {},
  ) {
    super(detail ?? title);
    this.name = new.target.name;
  }
}

export class ValidationFailedError extends CodedError {
  constructor(readonly errors: ValidationIssue[]) {
    super(
      'validation',
      'validation_failed',
      'Request validation failed',
      'One or more fields are invalid.',
    );
  }
}

export class UnauthenticatedError extends CodedError {
  constructor(detail = 'Missing or invalid credentials.') {
    super('unauthenticated', 'unauthenticated', 'Unauthenticated', detail);
  }
}

export class ForbiddenError extends CodedError {
  constructor(
    detail = 'The principal is not allowed to perform this operation.',
    code = 'forbidden',
  ) {
    super('forbidden', code, 'Forbidden', detail);
  }
}

export class NotFoundError extends CodedError {
  constructor(resource: string) {
    super('not_found', 'not_found', 'Not found', `${resource} was not found.`);
  }
}

export class ConflictError extends CodedError {
  constructor(code: string, detail: string) {
    super('conflict', code, 'Conflict', detail);
  }
}

export class UnprocessableError extends CodedError {
  constructor(code: string, detail: string) {
    super('unprocessable', code, 'Unprocessable request', detail);
  }
}

export class DependencyUnavailableError extends CodedError {
  constructor(dependency: string) {
    super(
      'unavailable',
      'dependency_unavailable',
      'Service unavailable',
      `${dependency} is unavailable.`,
    );
  }
}
