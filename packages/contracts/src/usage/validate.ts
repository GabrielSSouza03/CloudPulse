import {
  compileValidator,
  type ValidationIssue,
  type ValidationResult,
} from '../validation/compile.js';
import { ALLOWED_DIMENSIONS } from './event-types.js';
import { UsageEnvelopeV1 } from './envelope.v1.js';

const validateEnvelope = compileValidator<UsageEnvelopeV1>(UsageEnvelopeV1);

function semanticIssues(event: UsageEnvelopeV1): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowed = ALLOWED_DIMENSIONS[event.eventType];
  const seen = new Set<string>();
  event.measurements.forEach((m, i) => {
    const spec = allowed.get(m.dimension);
    if (!spec) {
      issues.push({
        path: `/measurements/${i}/dimension`,
        code: 'dimension_not_allowed',
        message: `dimension ${m.dimension} is not allowed for ${event.eventType}`,
      });
    } else if (spec.unit !== m.unit) {
      issues.push({
        path: `/measurements/${i}/unit`,
        code: 'unit_mismatch',
        message: `dimension ${m.dimension} requires unit ${spec.unit}`,
      });
    }
    if (seen.has(m.dimension)) {
      issues.push({
        path: `/measurements/${i}/dimension`,
        code: 'duplicate_dimension',
        message: `dimension ${m.dimension} appears more than once`,
      });
    }
    seen.add(m.dimension);
  });
  if (
    event.eventType === 'execution.completed' &&
    (event.outcome === undefined || event.outcome === null)
  ) {
    issues.push({
      path: '/outcome',
      code: 'missing_outcome',
      message: 'execution.completed requires outcome',
    });
  }
  return issues;
}

/**
 * Structural (JSON Schema) and semantic validation of one usage event.
 * Time-window checks (lateness, clock skew) depend on the receiver's clock and live in the gateway.
 */
export function validateUsageEvent(input: unknown): ValidationResult<UsageEnvelopeV1> {
  const structural = validateEnvelope(input);
  if (!structural.ok) return structural;
  const issues = semanticIssues(structural.value);
  return issues.length > 0 ? { ok: false, errors: issues } : structural;
}
