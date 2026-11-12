import { type PipeTransform } from '@nestjs/common';
import { compileValidator, type Validator } from '@cloudpulse/contracts';
import type { Static, TSchema } from '@sinclair/typebox';
import { ValidationFailedError } from '../../shared-kernel/errors.js';

/** Validates a request part against a TypeBox schema, throwing 400 problem details on failure. */
export class TypeBoxPipe<S extends TSchema> implements PipeTransform<unknown, Static<S>> {
  private readonly validate: Validator<Static<S>>;

  constructor(schema: S, options: { coerce?: boolean } = {}) {
    this.validate = compileValidator<Static<S>>(schema, {
      coerceTypes: options.coerce ?? false,
      useDefaults: true,
    });
  }

  transform(value: unknown): Static<S> {
    const result = this.validate(value ?? {});
    if (!result.ok) throw new ValidationFailedError(result.errors);
    return result.value;
  }
}
