# ADR-004: Budget reservations

- Status: Proposed
- Date: 2026-11-11

## Context

Agents request budget before they run. Many executions of the same tenant reserve concurrently
against the same budget periods, often several levels at once (tenant, team, workload). A hard limit
must never be exceeded, even under concurrency, retries and crashes.

## Decision

- Reserve with conditional atomic updates under READ COMMITTED:
  `UPDATE budget_period SET reserved_amount = reserved_amount + $1 WHERE id = $2 AND
reserved_amount + consumed_amount + $1 <= limit_amount RETURNING ...`. Zero rows means rejected.
- Multi-level reservations lock periods in a deterministic order (by id) inside one transaction to
  avoid deadlocks, and roll back entirely if any level rejects.
- Every movement (reserve, settle, release, expire, accrue) writes a balanced double-entry ledger
  transaction in the same database transaction, with a unique idempotency key.
- Reservations carry an idempotency key unique per tenant and an expiry; a scheduler sweep releases
  expired reservations.

## Alternatives

- **SELECT ... FOR UPDATE then UPDATE.** Correct but holds locks across two round trips.
- **SERIALIZABLE isolation.** Correct, but serialization failures under contention need retries and
  raise tail latency.
- **Redis Lua counters.** Fast, but Redis is not authoritative (ADR-003) and cannot share a
  transaction with the ledger.

## Consequences

- PostgreSQL's row-level re-check (EvalPlanQual) makes the conditional update safe under READ
  COMMITTED.
- A single hot budget period serializes its reservations; throughput per period is bounded by row
  lock hold time.

## Open questions

- When contention on one period justifies leases or escrow (pre-split sub-budgets per worker).
