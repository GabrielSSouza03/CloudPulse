# ADR-006: Pricing versioning

- Status: Proposed
- Date: 2026-11-11

## Context

Provider prices change, events arrive late, and invoices must be explainable months later. A cost
must be reproducible from the event and the price that applied when the usage happened.

## Decision

- A price book has versions. A published version is immutable and has an effective period; periods
  of published versions do not overlap per meter (provider, service, sku, region, dimension).
- Lookup is deterministic for `(meter, occurredAt)`. Receive time is never used for pricing.
- Each cost line records the price rule, price book version and FX rate it used, plus a calculation
  version.
- Repricing creates new cost lines that supersede old ones; the ledger records the difference as an
  adjustment. Nothing is updated in place.
- Usage with no applicable price is parked as unpriced and repriced when a price is published.

## Alternatives

- **Mutable prices.** Rejected: history becomes unexplainable.
- **Pricing at receive time.** Rejected: late events would be priced with the wrong version.

## Consequences

- Cost workers keep an in-memory snapshot of published versions, refreshed on publication events.
- Storage grows with versions and superseding lines, which is the price of auditability.

## Open questions

- How tiered pricing, committed-use discounts and free tiers are modeled (likely period-level
  adjustments rather than per-event prices).
