# ADR-005: At-least-once delivery and idempotency

- Status: Accepted
- Date: 2026-11-11

## Context

Producers retry, gateways retry produces, consumers are redelivered after crashes or rebalances, and
operators replay topics. Any of these can deliver the same usage event more than once. Charging
twice is the worst failure CloudPulse can have.

## Decision

- Delivery is at-least-once end to end. CloudPulse never claims exactly-once.
- Idempotency is enforced where state changes: unique constraints (cost lines per
  `(tenant, eventId, component)`, ledger idempotency keys, inbox `(consumer, message_id)`) and
  conditional state transitions in PostgreSQL.
- Consumers re-emit downstream events idempotently: a redelivered event produces the same output
  key, and downstream consumers deduplicate again.
- Wire format is JSON with a versioned JSON Schema. Envelope v1 is defined with TypeBox in
  `packages/contracts`; its generated schema is committed and checked for breaking changes in CI
  (removed fields, newly required fields, removed enum literals, tightened limits).
- API idempotency keys for control-plane writes (reservations) are introduced with the endpoints
  that need them in Phase 4.

## Alternatives

- **Kafka transactions (exactly-once semantics).** They cover only the stream legs, not the
  PostgreSQL writes, so database idempotency would still be required. Not adopted.
- **Protobuf or Avro with a schema registry.** Smaller and faster, but adds tooling and a registry
  dependency. Deferred until a benchmark shows serialization or bandwidth is a bottleneck.

## Consequences

- Every consumer and every write path must be designed to be safely repeated, and tested with
  duplicate deliveries.
- JSON costs CPU and bytes; decimal quantities are strings to stay exact.

## Open questions

- At what measured cost a binary format pays for itself.
