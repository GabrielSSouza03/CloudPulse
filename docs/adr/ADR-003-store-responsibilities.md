# ADR-003: Store responsibilities

- Status: Accepted
- Date: 2026-11-11

## Context

CloudPulse uses PostgreSQL, ClickHouse, Redis and Redpanda. Without explicit ownership, money could
end up computed from a store with eventual semantics, or a cache could become a hidden source of
truth.

## Decision

- **PostgreSQL 18 is authoritative** for tenants, keys, workloads, pricing, per-event cost lines (a
  hot window partitioned by month, then archived), budgets, reservations, the ledger, policies,
  actions, approvals, audit, reconciliation, outbox, inbox and idempotency records.
- **ClickHouse is derived and rebuildable** from PostgreSQL cost lines and the raw topic. It serves
  analytics and is never used to decide an amount of money.
- **Redis is never authoritative.** It holds caches, token-bucket rate limits and a best-effort
  dedupe pre-filter. Every use has a documented degraded mode.
- **Redpanda is the durable transport**, with retention covering the replay window.

## Alternatives

- **ClickHouse as the cost-line authority.** Rejected: ReplacingMergeTree deduplication is eventual,
  so "zero duplicate charges" cannot be proven, and accruals cannot be tied to newly inserted lines.

## Consequences

- A unique constraint on cost lines is the idempotency proof, and `INSERT ... ON CONFLICT DO NOTHING
RETURNING` identifies exactly which lines are new, so accruals are computed only from those.
- PostgreSQL carries the per-event write volume, mitigated by batched inserts, monthly partitions and
  a 90-day hot window.
- A daily job compares PostgreSQL and ClickHouse totals per tenant and day.

## Open questions

- The PostgreSQL write ceiling on the reference hardware (benchmark in Phase 3). The fallback is
  per-event lines in ClickHouse only, with PostgreSQL holding per-execution and per-hour accruals.
