import { Ajv, type ErrorObject, type Options } from 'ajv';
import addFormatsModule from 'ajv-formats';
import type { TSchema } from '@sinclair/typebox';

/** Stable, machine-readable validation codes. Clients may branch on these; never rename one. */
export type ValidationErrorCode =
  | 'required'
  | 'unknown_field'
  | 'invalid_type'
  | 'invalid_value'
  | 'invalid_decimal'
  | 'invalid_timestamp'
  | 'invalid_uuid'
  | 'invalid_format'
  | 'too_long'
  | 'too_many_items'
  | 'out_of_range'
  | 'unsupported_schema_version'
  | 'dimension_not_allowed'
  | 'unit_mismatch'
  | 'duplicate_dimension'
  | 'missing_outcome'
  | 'event_too_old'
  | 'event_in_future';

export type ValidationIssue = { path: string; code: ValidationErrorCode; message: string };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };

export type Validator<T> = (input: unknown) => ValidationResult<T>;

// ajv-formats is CommonJS; NodeNext types the default import as the namespace, not the plugin.
type FormatsPlugin = (ajv: Ajv, formats: string[]) => Ajv;
const formatsModule = addFormatsModule as unknown as FormatsPlugin & { default?: FormatsPlugin };
const addFormats: FormatsPlugin = formatsModule.default ?? formatsModule;

const instances = new Map<string, Ajv>();

function ajvFor(options: Pick<Options, 'coerceTypes' | 'useDefaults'>): Ajv {
  const key = JSON.stringify(options);
  let ajv = instances.get(key);
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true, ...options });
    addFormats(ajv, ['date-time', 'uuid', 'uri']);
    instances.set(key, ajv);
  }
  return ajv;
}

function codeFor(error: ErrorObject): ValidationErrorCode {
  switch (error.keyword) {
    case 'required':
      return 'required';
    case 'additionalProperties':
      return 'unknown_field';
    case 'type':
      return 'invalid_type';
    case 'const':
    case 'enum':
    case 'anyOf':
      return error.instancePath === '/schemaVersion'
        ? 'unsupported_schema_version'
        : 'invalid_value';
    case 'format': {
      const format = (error.params as { format?: string }).format;
      if (format === 'date-time') return 'invalid_timestamp';
      if (format === 'uuid') return 'invalid_uuid';
      return 'invalid_format';
    }
    case 'pattern':
      return error.instancePath.endsWith('/quantity') || error.instancePath.endsWith('/amount')
        ? 'invalid_decimal'
        : 'invalid_format';
    case 'maxLength':
      return 'too_long';
    case 'maxItems':
    case 'maxProperties':
      return 'too_many_items';
    case 'minimum':
    case 'maximum':
    case 'minLength':
    case 'minItems':
      return 'out_of_range';
    default:
      return 'invalid_value';
  }
}

function pathOf(error: ErrorObject): string {
  if (error.keyword === 'required') {
    return `${error.instancePath}/${(error.params as { missingProperty: string }).missingProperty}`;
  }
  if (error.keyword === 'additionalProperties') {
    return `${error.instancePath}/${(error.params as { additionalProperty: string }).additionalProperty}`;
  }
  return error.instancePath || '/';
}

export function toIssues(errors: readonly ErrorObject[]): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const error of errors) {
    // anyOf over literals reports one error per branch plus the anyOf summary; keep the summary.
    if (
      (error.keyword === 'const' || error.keyword === 'type') &&
      error.schemaPath.includes('anyOf')
    ) {
      continue;
    }
    const issue: ValidationIssue = {
      path: pathOf(error),
      code: codeFor(error),
      message: error.message ?? 'invalid',
    };
    const key = `${issue.path}|${issue.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push(issue);
    }
  }
  return issues;
}

/**
 * Compiles a TypeBox/JSON schema into a validator returning stable error codes.
 * With `coerceTypes` or `useDefaults`, Ajv mutates the input in place.
 */
export function compileValidator<T>(
  schema: TSchema,
  options: Pick<Options, 'coerceTypes' | 'useDefaults'> = {},
): Validator<T> {
  const validate = ajvFor(options).compile<T>(schema);
  return (input: unknown) =>
    validate(input)
      ? { ok: true, value: input as T }
      : { ok: false, errors: toIssues(validate.errors ?? []) };
}
