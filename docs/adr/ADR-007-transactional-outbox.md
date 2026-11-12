# ADR-007: Transactional outbox with a SKIP LOCKED relay

- Status: Proposed
- Date: 2026-11-11

## Context

State changes in PostgreSQL (a budget threshold crossed, a reservation settled, an action approved)
must produce events for other processes. Writing to the database and producing to Kafka separately
loses events or emits events for rolled-back changes.

## Decision

- State changes insert an `outbox` row in the same transaction.
- The `outbox-relay` worker claims unpublished rows in id order with
  `SELECT ... FOR UPDATE SKIP LOCKED LIMIT n`, produces them, and marks them published.
- A single active relay is elected with a PostgreSQL advisory lock, which preserves order per
  aggregate. Consumers deduplicate by message id (at-least-once, ADR-005).
- Published rows are deleted after 7 days.

## Alternatives

- **Debezium CDC.** More robust at high volume, but needs Kafka Connect and more memory. Postponed.
- **Dual writes.** Rejected: not atomic.

## Consequences

- Event latency equals the relay polling interval plus produce time.
- The outbox table needs vacuum-friendly deletes and an index on unpublished rows.

## Open questions

- Sharding the relay by aggregate hash if one leader cannot keep up.
