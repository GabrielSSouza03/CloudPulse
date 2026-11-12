# ADR-010: ClickHouse rollups over recomputed lateness windows

- Status: Proposed
- Date: 2026-11-11

## Context

Dashboards need hourly and daily cost rollups. The analytics sink receives duplicates under
at-least-once delivery, and ReplacingMergeTree collapses duplicates only eventually, at merge time.

## Decision

- Base tables (`cost_lines`, `usage_events`) use `ReplacingMergeTree` keyed for deduplication.
- Rollups (`cost_hourly`, `cost_daily`) are **not** insert-triggered materialized views, because such
  views aggregate each insert, so a duplicate insert is counted twice permanently.
- A scheduler job recomputes rollup buckets for `[now - lateness_window, now]` from deduplicated base
  data and writes them to a ReplacingMergeTree keyed by bucket, so recomputation is idempotent.

## Alternatives

- **Refreshable materialized views.** Equivalent semantics with less code; to be evaluated in Phase 3
  against the ClickHouse best-practice rules.
- **Insert-triggered materialized views.** Rejected for the reason above.

## Consequences

- Rollups lag by the job cadence.
- Recompute cost grows with the lateness window and must be measured.

## Open questions

- The final choice between the scheduler job and refreshable materialized views.
