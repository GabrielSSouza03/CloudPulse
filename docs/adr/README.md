# Architecture decision records

Each record states the context, the decision, the alternatives considered, the consequences and the
open questions. A record is **Accepted** when the decision is implemented or binding for current
work, and **Proposed** when it is designed but waits for the phase that implements it. Superseded
records stay in place with a link to their replacement.

| ADR                                              | Title                                               | Status   |
| ------------------------------------------------ | --------------------------------------------------- | -------- |
| [001](ADR-001-modular-monolith-process-roles.md) | Modular monolith with multiple process roles        | Accepted |
| [002](ADR-002-redpanda-kafka-protocol.md)        | Redpanda for development, Kafka protocol only       | Proposed |
| [003](ADR-003-store-responsibilities.md)         | Store responsibilities                              | Accepted |
| [004](ADR-004-budget-reservations.md)            | Budget reservations                                 | Proposed |
| [005](ADR-005-delivery-and-idempotency.md)       | At-least-once delivery and idempotency              | Accepted |
| [006](ADR-006-pricing-versioning.md)             | Pricing versioning                                  | Proposed |
| [007](ADR-007-transactional-outbox.md)           | Transactional outbox with a SKIP LOCKED relay       | Proposed |
| [008](ADR-008-multi-tenant-isolation.md)         | Multi-tenant isolation                              | Accepted |
| [009](ADR-009-action-approval-execution.md)      | Action approval and execution                       | Proposed |
| [010](ADR-010-clickhouse-rollups.md)             | ClickHouse rollups over recomputed lateness windows | Proposed |
| [011](ADR-011-kafka-client.md)                   | Kafka client                                        | Accepted |
| [012](ADR-012-validation.md)                     | TypeBox and Ajv for contracts and API validation    | Proposed |
