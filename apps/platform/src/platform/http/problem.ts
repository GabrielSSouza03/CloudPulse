import type { ValidationIssue } from '@cloudpulse/contracts';
import type { ErrorCategory } from '../../shared-kernel/errors.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
const TYPE_BASE = 'https://cloudpulse.dev/problems/';

/** RFC 9457 problem details body, plus CloudPulse extension members. */
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  traceId?: string;
  requestId?: string;
  errors?: ValidationIssue[];
  [extension: string]: unknown;
};

export const CATEGORY_STATUS: Readonly<Record<ErrorCategory, number>> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  unavailable: 503,
};

export function problemType(code: string): string {
  return `${TYPE_BASE}${code.replace(/_/g, '-')}`;
}
