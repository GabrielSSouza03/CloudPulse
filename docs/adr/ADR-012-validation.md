# ADR-012: TypeBox and Ajv for contracts and API validation

- Status: Proposed
- Date: 2026-11-11

## Context

Event contracts are shared with producers outside this repository, and API inputs need validation
with stable, machine-readable error codes. Two validation systems would drift.

## Decision

- Schemas are written once with TypeBox, which yields both TypeScript types and standard JSON Schema.
- Ajv compiles them (`compileValidator` in `packages/contracts`) for envelopes, API DTOs
  (`TypeBoxPipe`) and environment configuration. Ajv errors map to stable codes (`required`,
  `invalid_type`, `invalid_format`, `too_long`, `unknown_field` and others) with JSON Pointer paths.
- Semantic rules that JSON Schema cannot express (allowed dimensions per event type, units, event
  time window) are separate functions returning the same issue shape.
- The committed JSON Schema snapshot gates breaking changes in CI (ADR-005).

## Alternatives

- **class-validator with DTO classes.** Idiomatic in NestJS, but produces no portable schema for
  producers and relies on decorators.
- **Zod.** Good ergonomics, but JSON Schema output is a conversion step rather than the native form.

## Consequences

- One schema language for events, API and configuration.
- OpenAPI generation from the same schemas is not implemented yet; it is the remaining step before
  this record is accepted.

## Open questions

- Whether to generate OpenAPI with `@nestjs/swagger` fed by TypeBox schemas or with a small custom
  generator.
